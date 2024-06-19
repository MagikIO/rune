import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Rune from '../src/Rune.js';


describe('Rune', () => {
  describe('new Rune()', () => {
    it('should initialize with default options', () => {
      try {
        const rune = new Rune({ entryPointDir: './src' });
        expect(rune.mode).toBe('production');
        expect(rune.logLevel).toBe('verbose');
      } catch (error) {
        console.error(error);
      }
    });

    it('should initialize with custom options', () => {
      const rune = new Rune({ mode: 'development', logLevel: 'info', entryPointDir: './../src' });
      expect(rune.mode).toBe('development');
      expect(rune.logLevel).toBe('info');
    });
  });

  describe('[S] Rune.jResolve()', () => {
    it('should correctly join then resolve paths', () => {
      const resolvedPath = Rune.jResolve('src', 'pages');
      expect(resolvedPath).toBe(resolve(join(process.cwd(), 'src', 'pages')));
    });
  });

  describe('[S] Rune.tools())', () => {
    it('should return an object with a working jResolve method', () => {
      const tools = Rune.tools('/custom/root');
      expect(tools.jResolve('src')).toBe(resolve(join('/custom/root', 'src')));
    });
  });

  describe('[M] rune.getEntries()', () => {
    it('should retrieve entries using GlobWatcher', () => {
      const rune = new Rune({ entryPointDir: './src' });
      expect(rune.getEntries()).toEqual({ 'src/Rune': ['src/Rune.ts'] });
    });
  });

  describe('Configuration Methods ->', () => {
    const rune = new Rune({ entryPointDir: './src' });
    it('[M] DEFAULT_PROD_CONFIG should create correct production configuration', () => {
      const config = rune.DEFAULT_PROD_CONFIG();
      expect(config.mode).toBe('production');
    });

    it('DEFAULT_CSS_CONFIG should include CSS rules', () => {
      const config = rune.DEFAULT_CSS_CONFIG();
      const rules = config.module!.rules as Array<{ test: RegExp }>;
      expect(rules.some(rule => rule.test.toString().includes('.css'))).toBe(true);
    });

    it('DEFAULT_DEV_CONFIG should create correct development configuration', () => {
      const config = rune.DEFAULT_DEV_CONFIG();
      expect(config.mode).toBe('development');
    });
  });

  describe('getConfig Method', () => {
    it('should merge configurations based on mode and options', () => {
      const rune = new Rune({ entryPointDir: './src', mode: 'development' });
      const config = rune.getConfig();
      expect(config.mode).toBe('development');
    });
  });

  describe('Configuration options ->', () => {
    it('should allow for the use of of project references', () => {
      const rune = new Rune({ entryPointDir: './src', useProjectRefs: true });
      expect(rune.useProjectRefs).toBe(true);
      const devRules = rune.DEFAULT_DEV_CONFIG().module!.rules as Array<{ options: { projectReferences: boolean } }>
      expect(devRules[0].options.projectReferences).toBe(true);
    });

    it('should allow for the bundling of CSS', () => {
      const rune = new Rune({ entryPointDir: './src', bundleCSS: true });
      expect(rune.bundleCSS).toBe(true);
      const prodRules = rune.getConfig() as { module: { rules: Array<{ test: RegExp }> } };
      expect(prodRules.module.rules.some(rule => rule.test.toString().includes('.css'))).toBe(true);
    });

    it('should allow for the use of a custom tsconfig file', () => {
      const rune = new Rune({ entryPointDir: './src', tsConfig: 'tsconfig.prod.json' });
      expect(rune.tsConfig).toBe('tsconfig.prod.json');
      const prodOptions = rune.DEFAULT_PROD_CONFIG() as { module: { rules: Array<{ options: { configFile: string } }> }; }
      expect(prodOptions.module.rules[0].options.configFile).toBe('tsconfig.prod.json');
    })

    it('should allow for the use of a custom log level', () => {
      const rune = new Rune({ entryPointDir: './src', logLevel: 'log' });
      expect(rune.logLevel).toBe('log');
    });

    describe('should allow for the use of a custom output directory', () => {
      it('should allow for out directory to be relative', () => {
        const rune = new Rune({ entryPointDir: './src', outputDir: './testOut' });
        expect(rune.outputDir).toBe('/home/navi/Code/rune/testOut');
        const prodOutput = rune.DEFAULT_PROD_CONFIG().output as { path: string };
        expect(prodOutput.path).toBe('/home/navi/Code/rune/testOut');
      });

      it('should allow for out directory to be absolute', () => {
        const rune = new Rune({ entryPointDir: './src', outputDir: '/home/navi/Code/rune/testOut' });
        expect(rune.outputDir).toBe('/home/navi/Code/rune/testOut');
        const prodOutput = rune.DEFAULT_PROD_CONFIG().output as { path: string };
        expect(prodOutput.path).toBe('/home/navi/Code/rune/testOut');
      });
    });

    describe('should allow for the use of a custom manifest file', () => {
      it('should allow for manifest file to be relative', () => {
        const rune = new Rune({ entryPointDir: './src', manifest: './testManifest.json' });
        expect(rune.manifest).toBe('/home/navi/Code/rune/testManifest.json');
      });
      it('should allow for manifest file to be absolute', () => {
        const rune = new Rune({ entryPointDir: './src', manifest: '/test/testManifest.json' });
        expect(rune.manifest).toBe('/test/testManifest.json');
      })
    });

    it('should allow for the use of a custom development URL', () => {
      const rune = new Rune({ entryPointDir: './src', developmentURL: 'http://localhost:3000' });
      expect(rune.developmentURL).toBe('http://localhost:3000');
    });

    describe('should allow you to set an entryPointDir', () => {
      it('should allow for entryPointDir to be relative', () => {
        const rune = new Rune({ entryPointDir: './src' });
        expect(rune.entryPointDir).toBe('./src');
      });

      it('should allow for entryPointDir to be absolute', () => {
        const rune = new Rune({ entryPointDir: '/src' });
        expect(rune.entryPointDir).toBe('/home/navi/Code/rune/src');
      });
    });

    describe('should allow you to set debug mode', () => {
      describe('debug: enable', () => {
        it('should enable debug mode', () => {
          const rune = new Rune({ entryPointDir: './src', debug: true });
          expect(rune.debug).toBe(true);
        });

        it('should have extra logs one turned on if you use the getConfig option', () => {
          const rune = new Rune({ entryPointDir: './src', debug: true });
          const config = rune.getConfig();
          expect(config.mode).toBe('production');
        })
      });

      it('should default to debug mode being disabled', () => {
        const rune = new Rune({ entryPointDir: './src', debug: false });
        expect(rune.debug).toBe(false);
      });
    })
  })
});
