/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobWatcher } from '../src/plugins/GlobWatcher.js';
import path from 'node:path';
import type { Compilation, Compiler } from 'webpack';

// mock fast-glob


describe('GlobWatcher', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  describe('GlobWatcher.getEntries', () => {
    it('should return an empty object when no globs are provided', () => {
      expect(GlobWatcher.getEntries([])).toEqual({});
    });

    it('should return the correct entries when globs are provided', () => {
      expect(GlobWatcher.getEntries(["./src/**/**.ts"])).toEqual({
        "Rune": ["./src/Rune.ts"],
        "plugins/GlobWatcher": ["./src/plugins/GlobWatcher.ts"],
        "types/Types": ["./src/types/Types.ts"],
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
      const globs = './src/**/*.ts';
      expect(() => GlobWatcher.getEntries(globs)).not.toThrow();
      expect(Array.isArray(globs)).toBe(false); // Original globs variable should remain unchanged
    });


    it('does not throw if globs is an array of strings and globOptions is an object', () => {
      expect(() => GlobWatcher.getEntries(['./src/**/*.ts'], { globOptions: {} })).not.toThrow();
    });
  });

  describe('GlobWatcher.getFiles', () => {
    it('should return an empty object when no files are found', () => {
      expect(GlobWatcher.getFiles('./src/**/*.html')).toEqual({});
    });

    it('should return the correct files when files are found', () => {
      expect(GlobWatcher.getFiles('./src/**/*.ts')).toEqual({
        'Rune': ['./src/Rune.ts'],
        'plugins/GlobWatcher': ['./src/plugins/GlobWatcher.ts'],
        'types/Types': ['./src/types/Types.ts'],
      });
    });

    it('should return the correct files with basename as entry name', () => {
      expect(GlobWatcher.getFiles('./src/**/*.ts', { basename_as_entry_name: true })).toEqual({
        "GlobWatcher": ["./src/plugins/GlobWatcher.ts"],
        "Rune": ["./src/Rune.ts"],
        "Types": ["./src/types/Types.ts"],
      });
    });

    describe('with includeHMR option', () => {
      it('should include HMR entries in development environment', () => {
        process.env.NODE_ENV = 'development';
        const result = GlobWatcher.getFiles('./src/**/*.ts', { includeHMR: true });
        expect(result).toEqual({
          'Rune': ["webpack-hot-middleware/client?path=http://localhost:5000/__webpack_hmr&timeout=20000&reload=true", "./src/Rune.ts"],
          'plugins/GlobWatcher': ["webpack-hot-middleware/client?path=http://localhost:5000/__webpack_hmr&timeout=20000&reload=true", "./src/plugins/GlobWatcher.ts"],
          'types/Types': ["webpack-hot-middleware/client?path=http://localhost:5000/__webpack_hmr&timeout=20000&reload=true", "./src/types/Types.ts"],
        });
      });

      it('should not include HMR entries in production environment', () => {
        process.env.NODE_ENV = 'production';

        const result = GlobWatcher.getFiles('./src/**/*.ts', { includeHMR: true });
        expect(result).toEqual({
          'Rune': ['./src/Rune.ts'],
          'plugins/GlobWatcher': ['./src/plugins/GlobWatcher.ts'],
          'types/Types': ['./src/types/Types.ts'],
        });
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
      const globWatcher = new GlobWatcher();

      GlobWatcher.getEntries(["./src/**/**.ts"]);
      globWatcher.afterCompile(v4Mock, callback);

      expect(v4Mock.contextDependencies.size).toBe(GlobWatcher.directories.size);
      GlobWatcher.directories.forEach((dir) => {
        expect(v4Mock.contextDependencies.has(path.normalize(dir))).toBe(true);
      });
      expect(callback).toHaveBeenCalled();

      GlobWatcher.directories.clear()
    });

    it('should add directories to contextDependencies array for Webpack < 4', () => {
      // Mock object adjusted to bypass TypeScript error, consider adding necessary properties or refining the mock to better match the 'Compilation' type
      const v3Mock = { contextDependencies: [] as string[] }
      const callback = vi.fn();
      const globWatcher = new GlobWatcher();

      GlobWatcher.getEntries(["./src/**/**.ts"]);
      globWatcher.afterCompile(v3Mock as unknown as Compilation, callback);

      expect(v3Mock.contextDependencies.length).toBe(GlobWatcher.directories.size);

      GlobWatcher.directories.forEach((dir) => {
        expect(v3Mock.contextDependencies.includes(path.normalize(dir))).toBe(true);
      });
      expect(callback).toHaveBeenCalled();
    });
  });
});
