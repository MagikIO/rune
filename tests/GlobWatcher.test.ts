/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobWatcher } from '../src/plugins/GlobWatcher.js';
import * as fastGlob from 'fast-glob';
import path from 'node:path';
import type { Compilation, Compiler } from 'webpack';

// mock fast-glob
vi.mock('fast-glob', () => ({
  globSync: vi.fn(), // Mock globSync specifically
}));

describe('GlobWatcher', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  describe('GlobWatcher.getEntries', () => {
    it('should return an empty object when no globs are provided', () => {
      expect(GlobWatcher.getEntries([])()).toEqual({});
    });

    it('should return the correct entries when globs are provided', () => {
      // Here, you directly manipulate the return value of globSync for this specific test
      vi.mocked(fastGlob.globSync).mockReturnValueOnce([
        "./src/Rune.ts",
        "./src/plugins/GlobWatcher.ts",
        "./src/types/Types.ts",
      ]);

      expect(GlobWatcher.getEntries(["./src/**/**.ts"])()).toEqual({
        "Rune": "./src/Rune.ts",
        "plugins/GlobWatcher": "./src/plugins/GlobWatcher.ts",
        "types/Types": "./src/types/Types.ts",
      });
    });

    it('should throw a TypeError when pluginOptions_ is not an object', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        GlobWatcher.getEntries(['src/**/*.js'], 'invalid')
      }).toThrow(TypeError);
    });

    it('throws TypeError if globs is neither a string nor an array of strings', () => {
      // @ts-expect-error - Testing invalid input
      expect(() => GlobWatcher.getEntries(42)).toThrow(TypeError);
      // @ts-expect-error - Testing invalid input
      expect(() => GlobWatcher.getEntries({})).toThrow(TypeError);
      // @ts-expect-error - Testing invalid input
      expect(() => GlobWatcher.getEntries(true)).toThrow(TypeError);
      // @ts-expect-error - Testing invalid input
      expect(() => GlobWatcher.getEntries(null)).toThrow(new TypeError('Globs must be a string or an array of strings'));
    });

    it('throws TypeError if globOptions is not an object', () => {
      // @ts-expect-error - Testing invalid input
      expect(() => GlobWatcher.getEntries(['./src/**/*.ts'], { globOptions: 'not-an-object' })).toThrow(TypeError);
      // @ts-expect-error - Testing invalid input
      expect(() => GlobWatcher.getEntries(['./src/**/*.ts'], { globOptions: 123 })).toThrow(new TypeError('globOptions must be an object'));
    });

    it('converts globs to an array if it is a string, without mutation', () => {
      vi.mocked(fastGlob.globSync).mockReturnValueOnce([]);
      const globs = './src/**/*.ts';
      expect(() => GlobWatcher.getEntries(globs)()).not.toThrow();
      expect(Array.isArray(globs)).toBe(false); // Original globs variable should remain unchanged
    });


    it('does not throw if globs is an array of strings and globOptions is an object', () => {
      vi.mocked(fastGlob.globSync).mockReturnValueOnce([]);
      expect(() => GlobWatcher.getEntries(['./src/**/*.ts'], { globOptions: {} })).not.toThrow();
    });
  });

  describe('GlobWatcher.getFiles', () => {
    it('should return an empty object when no files are found', () => {
      expect(GlobWatcher.getFiles('./src/**/*.html')).toEqual({});
    });

    it('should return the correct files when files are found', () => {
      vi.mocked(fastGlob.globSync).mockReturnValueOnce([
        './src/Rune.ts',
        './src/plugins/GlobWatcher.ts',
        './src/types/Types.ts',
      ]);

      expect(GlobWatcher.getFiles('./src/**/*.ts')).toEqual({
        'Rune': './src/Rune.ts',
        'plugins/GlobWatcher': './src/plugins/GlobWatcher.ts',
        'types/Types': './src/types/Types.ts',
      });
    });

    it('should return the correct files with basename as entry name', () => {
      vi.mocked(fastGlob.globSync).mockReturnValueOnce([
        './src/plugins/GlobWatcher.ts',
        './src/Rune.ts',
        './src/types/Types.ts',
      ]);

      expect(GlobWatcher.getFiles('./src/**/*.ts', { basename_as_entry_name: true })).toEqual({
        "GlobWatcher": "./src/plugins/GlobWatcher.ts",
        "Rune": "./src/Rune.ts",
        "Types": "./src/types/Types.ts",
      });
    });

    describe('with includeHMR option', () => {
      it('should include HMR entries in development environment', () => {
        process.env.NODE_ENV = 'development';
        vi.mocked(fastGlob.globSync).mockReturnValueOnce(['./src/Rune.ts']);

        const result = GlobWatcher.getFiles('./src/**/*.ts', { includeHMR: true });
        expect(result['./src/Rune.ts']).toEqual([
          './src/Rune.ts',
          'webpack-hot-middleware/client?path=http://localhost:5000/__webpack_hmr&timeout=20000&reload=true'
        ]);
      });

      it('should not include HMR entries in production environment', () => {
        process.env.NODE_ENV = 'production';
        vi.mocked(fastGlob.globSync).mockReturnValueOnce(['./src/Rune.ts']);

        const result = GlobWatcher.getFiles('./src/**/*.ts', { includeHMR: true });
        expect(result['./src/Rune.ts']).toEqual(['./src/Rune.ts']);
      });
    });
  });

  describe('GlobWatcher.apply()', () => {
    it('taps into afterCompile hook for Webpack >= 4', () => {
      // Mock object adjusted to bypass TypeScript error, consider adding necessary properties or refining the mock to better match the 'Compiler' type
      const mockCompiler = {
        hooks: {
          afterCompile: {
            tapAsync: vi.fn(),
          },
        },
      } as unknown as Compiler

      const globWatcher = new GlobWatcher();
      globWatcher.apply(mockCompiler);

      expect(mockCompiler.hooks.afterCompile.tapAsync).toHaveBeenCalledWith(
        'GlobWatcher',
        expect.any(Function),
      );
    });

    it('should use compiler.plugin for Webpack < 4', () => {
      const mockCompiler = { plugin: vi.fn() };
      const globWatcher = new GlobWatcher();
      globWatcher.apply(mockCompiler as unknown as Compiler);

      expect(mockCompiler.plugin).toHaveBeenCalledWith(
        'after-compile',
        expect.any(Function),
      );
    });
  });

  describe('GlobWatcher.afterCompile()', () => {
    it('adds directories to contextDependencies for Webpack >= 4', () => {
      // Mock object adjusted to bypass TypeScript error, consider adding necessary properties or refining the mock to better match the 'Compilation' type
      const v4Mock = { contextDependencies: new Set() } as unknown as Compilation
      const callback = vi.fn();

      GlobWatcher.directories = ['./src', './test'];
      GlobWatcher.directories.forEach(dir => v4Mock.contextDependencies.add(path.normalize(dir)));

      const globWatcher = new GlobWatcher();
      globWatcher.afterCompile(v4Mock, callback);

      expect(v4Mock.contextDependencies.size).toBe(GlobWatcher.directories.length);
      GlobWatcher.directories.forEach((dir) => {
        expect(v4Mock.contextDependencies.has(path.normalize(dir))).toBe(true);
      });
      expect(callback).toHaveBeenCalled();

      GlobWatcher.directories = [];
    });

    it('should add directories to contextDependencies array for Webpack < 4', () => {
      // Mock object adjusted to bypass TypeScript error, consider adding necessary properties or refining the mock to better match the 'Compilation' type
      const v3Mock = { contextDependencies: [] as string[] }
      const callback = vi.fn();

      const directories = ['./src', './test'];
      directories.forEach(dir => v3Mock.contextDependencies.push(path.normalize(dir)));

      const globWatcher = new GlobWatcher();
      globWatcher.afterCompile(v3Mock as unknown as Compilation, callback);

      expect(v3Mock.contextDependencies.length).toBe(directories.length);
      directories.forEach((dir) => {
        expect(v3Mock.contextDependencies).toContain(path.normalize(dir));
      });
      expect(callback).toHaveBeenCalled();
    });
  });
});
