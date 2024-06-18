import { bind, globSync as glob, type globSync } from 'fast-glob';
import globParent from 'glob-parent';
import path, { basename, constructor, extname, join, normalize, relative, sep } from 'node:path';
import { isArray } from 'node:util';
import type { apply, Compilation, Compiler } from 'webpack';

const directories: string[] = [];

/**
 * class WebpackWatchedGlobEntries
 */
export class WebpackWatchedGlobEntries {
    static getEntries(globs: string | string[], globOptions: Record<string, unknown>, pluginOptions_?: Record<string, unknown>): () => Record<string, string> {
        // Type check pluginOptions_
        if (typeof pluginOptions_ !== 'undefined' && typeof pluginOptions_ !== 'object') throw new TypeError('pluginOptions_ must be an object');

        // Options defaults
        const pluginOptions: Record<string, unknown> = Object.assign({ basename_as_entry_id: false }, pluginOptions_);

        return function(): Record<string, string> {
            // Check if globs are provided properly
            if (typeof globs !== 'string' && !Array.isArray(globs)) throw new TypeError('globOptions must be a string or an array of strings');
            // Check globOptions if provided properly
            if (globOptions && typeof globOptions !== 'object') throw new TypeError('globOptions must be an object');

            // Make entries an array
            if (!Array.isArray(globs)) {
                globs = [globs];
            }

            //
            let globbedFiles: Record<string, string> = {};

            // Map through the globs
            globs.forEach(function(globString: string) {

                const base = globParent(globString, {});

                // Dont add if its already in the directories
                if (directories.indexOf(base) === -1) {
                    directories.push(base);
                }

                // Get the globbedFiles
                const files = WebpackWatchedGlobEntries.getFiles(globString, globOptions, pluginOptions.basename_as_entry_name);

                // Set the globbed files
                globbedFiles = Object.assign(files, globbedFiles);

            });

            return globbedFiles;
        };
    }

    /**
     * Create webpack file entry object
     * @param globString
     * @param globOptions
     * @param basename_as_entry_name
     * @returns {Object}
     */
    static getFiles(globString: string, globOptions: Record<string, unknown>, basename_as_entry_name: boolean): Record<string, string> {

        const files: Record<string, string> = {};

        const base = globParent(globString, {});

        glob(globString, globOptions).forEach((file: string) => {
            // Format the entryName
            let entryName = path
            .relative(base, file)
            .replace(path.extname(file), '')
            .split(path.sep)
            .join('/');

            if (basename_as_entry_name) entryName = path.basename(entryName);

            // Add the entry to the files obj
            files[entryName] = file;
        });

        return files;
    }

    /**
     * Install Plugin
     * @param {Object} compiler
     */
    apply(compiler: Compiler): void {
        if (compiler.hooks) {
            // Support Webpack >= 4
            compiler.hooks.afterCompile.tapAsync(this.constructor.name, this.afterCompile.bind(this));
        } else {
            // Support Webpack < 4

            /* eslint-disable */
            // @ts-expect-error - TS doesn't know about the plugin method, as we are using types from webpack 5
            compiler.plugin('after-compile', this.afterCompile);
            /* eslint-enable */
        }
    }

    /**
     * After compiling, give webpack the globbed files
     * @param {Object} compilation
     * @param {Function} callback
     */
    afterCompile(compilation: Compilation, callback: () => void): void {
        if (Array.isArray(compilation.contextDependencies)) {
            // Support Webpack < 4
            compilation.contextDependencies = compilation.contextDependencies.concat(directories);
        } else {
            // Support Webpack >= 4
            for (const directory of directories) {
                compilation.contextDependencies.add(path.normalize(directory));
            }
        }
        callback();
    }
}
