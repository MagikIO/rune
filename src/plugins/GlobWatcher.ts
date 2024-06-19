import { Options, globSync } from 'fast-glob';
import globParent from 'glob-parent';
import path from 'node:path';
import type { Compilation, Compiler } from 'webpack';

interface PluginOptions {
  basename_as_entry_id?: boolean;
  basename_as_entry_name?: boolean;
  globOptions?: Options;
  includeHMR?: boolean;
}

export class GlobWatcher {
  public static directories = [] as string[];

  static getEntries(globs: string | string[], pluginOptions?: PluginOptions): () => Record<string, string | Array<string>> {
    if (typeof pluginOptions !== 'undefined' && typeof pluginOptions !== 'object') throw new TypeError('pluginOptions_ must be an object');
    // Check if globs are provided properly
    if (typeof globs !== 'string' && !Array.isArray(globs)) throw new TypeError('Globs must be a string or an array of strings');
    // Check if globOptions is provided properly
    if (pluginOptions?.globOptions && typeof pluginOptions.globOptions !== 'object') throw new TypeError('globOptions must be an object');
    // Options defaults
    const options = Object.assign({ basename_as_entry_id: false }, pluginOptions);
    // Reset directories
    GlobWatcher.directories.length = 0;

    return function () {
      // Make entries an array
      if (!Array.isArray(globs)) globs = [globs];
      let globbedFiles: Record<string, string | Array<string>> = {};

      // Map through the globs
      globs.forEach((globString: string) => {
        const base = globParent(globString);
        // Dont add if its already in the directories
        if (GlobWatcher.directories.indexOf(base) === -1) GlobWatcher.directories.push(base);
        // Get the globbedFiles
        const files = GlobWatcher.getFiles(globString, options);
        // Set the globbed files
        if (files) globbedFiles = Object.assign(files, globbedFiles);
      });

      return globbedFiles;
    };
  }

  static getFiles(globString: string, pluginOptions?: PluginOptions) {
    const files: Record<string, string | Array<string>> = {};
    const base = globParent(globString);
    const globOptions = pluginOptions?.globOptions ?? {};

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

      if (pluginOptions?.includeHMR) {
        if (process.env.NODE_ENV === 'development') {
          files[file] = [
            'webpack-hot-middleware/client?path=http://localhost:5000/__webpack_hmr&timeout=20000&reload=true',
            file
          ]
        }
        if (process.env.NODE_ENV === 'production') { files[file] = [file]; }
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
    if (compilation.contextDependencies instanceof Set) { // Support Webpack >= 4
      for (const directory of GlobWatcher.directories) {
        compilation.contextDependencies.add(path.normalize(directory));
      }
    } else if (Array.isArray(compilation.contextDependencies)) { // Support Webpack < 4
      /* eslint-disable */
      // @ts-expect-error - TS doesn't know about the plugin method, as we are using types from webpack 5
      compilation.contextDependencies = compilation.contextDependencies.concat(GlobWatcher.directories);
    } /* eslint-enable */

    callback();
  }
}
