import { resolve, join } from 'node:path';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import { consola } from 'consola';
import { colorize } from 'consola/utils';
import { globSync as glob } from 'fast-glob';
import type { Configuration } from 'webpack';


type RelativePath = `./${string}`;
type AbsolutePath = `/${string}`;
type AbsoluteJSONPath = `${AbsolutePath}.json`;

function isRelative(path: string): path is RelativePath {
  return path.startsWith('./') || path.startsWith('../');
}


export interface RuneOptions {
  /** The root directory of the project, defaults to `process.cwd()` */
  rootDir?: string;
  /**
   * The directory where the entry points are located
   * @type {RelativePath}
   * */
  entryPointDir: RelativePath;
  /**
   * The directory where the output files will be saved
   * @type {AbsolutePath|RelativePath}
   * */
  outputDir?: AbsolutePath | RelativePath;
  /**
   * The directory where the manifest file will be saved
   * @type {AbsoluteJSONPath}
   * */
  manifest?: AbsoluteJSONPath;
  tsConfig?: string;
}

export default class RuneConfig {
  protected static rootDir = process.cwd();
  protected entryPointDir: RelativePath = './src/pages';
  protected outputDir: AbsolutePath = RuneConfig.jResolve('public', 'bundles');
  protected manifest: AbsoluteJSONPath = RuneConfig.jResolve('assets', 'manifest.json') as AbsoluteJSONPath;

  protected tsConfig = './tsconfig.bundle.json';
  protected entries: Record<string, string>;

  public static jResolve<Paths extends Array<string> = string[]>(...paths: Paths) {
    return resolve(join(this.rootDir, ...paths)) as AbsolutePath
  }

  public static initTools(rootDir: string = process.cwd()) {
    RuneConfig.rootDir = rootDir;
    return this;
  }

  constructor({ entryPointDir, rootDir, manifest, outputDir, tsConfig }: RuneOptions) {
    RuneConfig.rootDir = rootDir ?? process.cwd();

    if (tsConfig) this.tsConfig = tsConfig;
    if (entryPointDir) {
      this.entryPointDir = isRelative(entryPointDir)
        ? entryPointDir
        : join(RuneConfig.rootDir, entryPointDir) as RelativePath;
    }
    if (outputDir) {
      this.outputDir = isRelative(outputDir)
        ? RuneConfig.jResolve(outputDir)
        : outputDir;
    }
    if (manifest) {
      this.manifest = isRelative(manifest)
        ? RuneConfig.jResolve(manifest) as AbsoluteJSONPath
        : manifest as AbsoluteJSONPath;
    }

    this.entries = this.getEntries();
  }

  private getEntries(): Record<string, string> {
    const { entryPointDir } = this;
    const { rootDir } = RuneConfig;

    return glob([`${entryPointDir}**/*.ts`], {
      cwd: rootDir,
      absolute: false,
      objectMode: true,
    }).map(({ path: entPath }) => {
      const newName = entPath
        .replace(entryPointDir, '').split('.ts')[0];

      entPath = entPath.startsWith('/') ? entPath.slice(1) : entPath;
      return { [newName]: entPath }
    }).reduce((acc, cur) => ({ ...acc, ...cur }), {});
  }

  protected DEFAULT_CONFIG = (): Configuration => ({
    context: RuneConfig.rootDir,
    mode: 'production',
    infrastructureLogging: { level: 'verbose' },
    watch: false,
    entry: this.entries,
    output: {
      path: this.outputDir,
      filename: '[name].js',
      publicPath: './bundles',
      clean: true,
      assetModuleFilename: './assets/[name].[ext][query]',
      asyncChunks: true,
      devtoolNamespace: 'veritas-magik',
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".json", "..."],
      extensionAlias: {
        ".js": [".js", ".ts"],
        ".cjs": [".cjs", ".cts"],
        ".mjs": [".mjs", ".mts"]
      },
    },
    module: {
      rules: [
        {
          test: /\.([cm]?ts|tsx)$/,
          include: RuneConfig.jResolve('src'),
          loader: 'ts-loader',
          options: { configFile: this.tsConfig, transpileOnly: true },
        },
      ],
    },
    plugins: [
      new WebpackManifestPlugin({
        filter: (file) => {
          if (!file.isInitial
            || file.name.endsWith('.map')
            || file.name.startsWith('node_module')) return false;
          return true;
        },
        publicPath: '/',
        fileName: this.manifest,
        useEntryKeys: true,
        map: (file) => {
          const nameSections = file.name.split('/');
          consola.info(`Added ${colorize('greenBright', nameSections[nameSections.length - 1])} to the manifest`);
          return { ...file, name: nameSections[nameSections.length - 1] };
        },
        sort: (a, b) => {
          const aPath = a.path.split('/');
          const bPath = b.path.split('/');
          consola.info({ aPath, bPath });
          return aPath[aPath.length - 1].localeCompare(bPath[bPath.length - 1]);
        },
      }),
    ],
  })

  public getConfig(configOptions: Configuration = this.DEFAULT_CONFIG()): Configuration {
    return Object.assign({}, this.DEFAULT_CONFIG(), configOptions)
  }
}
