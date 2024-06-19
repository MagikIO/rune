import { Options, globSync } from 'fast-glob';
import globParent from 'glob-parent';
import path from 'node:path';
import type { Compilation, Compiler } from 'webpack';

interface PluginOptions {
  basename_as_entry_id?: boolean;
  basename_as_entry_name?: boolean;
  globOptions?: Options;
  includeHMR?: boolean;
  developmentURL?: string;
}

export class GlobWatcher {
  public static directories = new Set<string>();

  static getEntries(globs: string | string[], pluginOptions?: PluginOptions) {
    // Make sure we have everything we need
    if (typeof pluginOptions !== 'undefined' && typeof pluginOptions !== 'object') throw new TypeError('pluginOptions_ must be an object');
    if (typeof globs !== 'string' && !Array.isArray(globs)) throw new TypeError('Globs must be a string or an array of strings');
    if (pluginOptions?.globOptions && typeof pluginOptions.globOptions !== 'object') throw new TypeError('globOptions must be an object');

    // Options defaults
    const options = Object.assign({ basename_as_entry_id: false }, pluginOptions);
    let globbedFiles: Record<string, string | Array<string>> = {};
    // Reset directories
    GlobWatcher.directories.clear();

    if (!Array.isArray(globs)) globs = [globs];

    // Map through the globs
    globs.forEach((globString: string) => {
      const base = globParent(globString);
      // Dont add if its already in the directories
      if (!GlobWatcher.directories.has(base)) GlobWatcher.directories.add(base);
      // Get the globbedFiles
      const files = GlobWatcher.getFiles(globString, options);
      // Set the globbed files
      if (files) globbedFiles = Object.assign(files, globbedFiles);
    });

    return globbedFiles;
  }

  static getFiles(globString: string, pluginOptions?: PluginOptions) {
    const files: Record<string, string | Array<string>> = {};
    const base = globParent(globString);
    const globOptions = pluginOptions?.globOptions ?? {};
    const developmentURL = pluginOptions?.developmentURL ?? 'http://localhost:5000';

    globSync(globString, globOptions)?.forEach((file: string) => {
      // Format the entryName
      let entryName = path
        .relative(base, file)
        .replace(path.extname(file), '')
        .split(path.sep)
        .join('/');

      if (pluginOptions?.basename_as_entry_name) entryName = path.basename(entryName);
      // Add the entry to the files obj
      files[entryName] = file;

      if (pluginOptions?.includeHMR && process.env.NODE_ENV === 'development') {
        files[entryName] = [
          file,
          `webpack-hot-middleware/client?path=${developmentURL}/__webpack_hmr&timeout=2000&reload=true`,
        ]
      } else {
        files[entryName] = [file];
      }
    });

    return files;
  }

  /**
   * Install Plugin
   * @param {Object} compiler
   */
  public apply(compiler: Compiler): void {
    if (compiler.hooks) {
      // Support Webpack >= 4
      compiler.hooks.afterCompile.tapAsync(this.constructor.name, this.afterCompile.bind(this));
    } else { // Support Webpack < 4
      /* eslint-disable */
      // @ts-expect-error - TS doesn't know about the plugin method, as we are using types from webpack 5
      compiler.plugin('after-compile', this.afterCompile);
    } /* eslint-enable */
  }

  /**
   * After compiling, give webpack the globbed files
   * @param {Object} compilation
   * @param {Function} callback
   */
  public afterCompile(compilation: Compilation, callback: () => void): void {

    for (const directory of GlobWatcher.directories) {
      if (compilation.contextDependencies instanceof Set) { // Support Webpack >= 4
        compilation.contextDependencies.add(path.normalize(directory));
      } else if (Array.isArray(compilation.contextDependencies)) { // Support Webpack < 4
        /* eslint-disable */
        compilation.contextDependencies.push(path.normalize(directory));
      } /* eslint-enable */
    }

    callback();
  }
}
