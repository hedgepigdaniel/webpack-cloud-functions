import webpack, {
  Configuration,
  Compiler,
  MultiStats,
  StatsCompilation,
} from "webpack";
import { default as webpackHotServerMiddleware } from "@hedgepigdaniel/webpack-hot-server-middleware";
import { createFsFromVolume, Volume } from "memfs";
import path from "path";
import { merge } from "webpack-merge";

export type HotWebpackOptions = {
  nodeVersion: number;
};

export const makeWebpackConfig = (
  baseConfig: Configuration = {}
): Configuration =>
  merge(
    {
      name: "server",
      output: {
        libraryTarget: "commonjs2",
      },
    },
    baseConfig
  );

export type HotHandlers<Handlers> = {
  getHandler: <Key extends keyof Handlers>(key: Key) => Handlers[Key];
  getProperty: <Key extends keyof Handlers>(key: Key) => Handlers[Key];
  proxy: Handlers;
};

type Invocation<Handlers> = {
  key: keyof Handlers;
  args: unknown[];
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const handleInvocation = <Handlers>(
  invocation: Invocation<Handlers>,
  getHandlers: () => Handlers,
  compilationErr: Error | undefined,
  compilationStats: MultiStats | undefined
): void => {
  if (
    compilationErr ||
    compilationStats?.hasErrors() ||
    compilationStats?.stats.find((stats) => stats.hasErrors())
  ) {
    invocation.reject(new Error("webpack compilation failed"));
    return;
  }

  const handler = getHandlers()[invocation.key];
  if (typeof handler !== "function") {
    invocation.reject(
      new Error(`cannot find a handler named ${invocation.key}`)
    );
    return;
  }
  invocation.resolve(handler(...invocation.args));
};

type CompilationStateSuccess = {
  type: "SUCCESS";
  stats: MultiStats;
  err: undefined;
  queuedInvocations: [];
};

type CompilationStateFailed = {
  type: "FAILED";
  stats: undefined;
  err: Error;
  queuedInvocations: [];
};

type CompilationStatePending<Handlers> = {
  type: "PENDING";
  stats: undefined;
  err: undefined;
  queuedInvocations: Invocation<Handlers>[];
};

type CompilationState<Handlers> =
  | CompilationStateFailed
  | CompilationStateSuccess
  | CompilationStatePending<Handlers>;

export const statsOptions: Configuration["stats"] = {
  all: false,
  warnings: true,
  errors: true,
  timings: true,
};

const makeProxy = <Handlers extends Record<string, unknown>>(
  getHandlers: () => Handlers
): Handlers =>
  (new Proxy(
    {},
    {
      get(target, property) {
        return getHandlers()[property as keyof Handlers];
      },
      set() {
        throw new Error("You cannot assign to a webpack-cloud-functions proxy");
      },
    }
  ) as unknown) as Handlers;

/**
 * Get a set of hot updating handlers from a webpack compilation
 * @param config
 */
export const makeHotHandlers = <
  Handlers extends Record<string | number | symbol, unknown>
>(
  config: Configuration
): HotHandlers<Handlers> => {
  const compiler = webpack([config]);
  compiler.compilers[0].outputFileSystem = createFsFromVolume(
    new Volume()
  ) as Compiler["outputFileSystem"];

  // Monkey patch for webpack 4 compatibility
  compiler.compilers[0].outputFileSystem.join = path.join.bind(path);

  const getHandlers = webpackHotServerMiddleware(compiler, {
    createHandler: (error, serverRenderer: () => Handlers) => () => {
      if (error) {
        throw error;
      }
      return serverRenderer();
    },
  });

  let compilationState: CompilationState<Handlers> = {
    type: "PENDING",
    stats: undefined,
    err: undefined,
    queuedInvocations: [],
  };

  compiler.hooks.invalid.tap("webpack-cloud-functions", () => {
    console.log("Recompiling...");
    compilationState = {
      type: "PENDING",
      stats: undefined,
      err: undefined,
      queuedInvocations: [],
    };
  });
  compiler.watch({}, (err, stats) => {
    if (err) {
      console.error(err);
    } else if (stats) {
      const info = stats.toJson(statsOptions);

      // We know there is one child compilation
      console.log(
        `Compilation complete after ${
          (info.children as [StatsCompilation])[0].time
        }ms.`
      );
      info.warnings?.forEach((warning) => {
        console.warn(warning);
      });
      info.errors?.forEach((error) => {
        console.error(error);
      });
    }

    compilationState.queuedInvocations.forEach((invocation) => {
      handleInvocation(invocation, getHandlers, err, stats);
    });
    if (err) {
      compilationState = {
        type: "FAILED",
        stats: undefined,
        err,
        queuedInvocations: [],
      };
    } else if (stats) {
      compilationState = {
        type: "SUCCESS",
        err: undefined,
        stats,
        queuedInvocations: [],
      };
    } else {
      throw new Error("no stats, no error");
    }
  });

  return {
    getHandler: (key) =>
      (((...args: unknown[]): Promise<unknown> =>
        new Promise((resolve, reject) => {
          const invocation: Invocation<Handlers> = {
            resolve,
            reject,
            key,
            args,
          };
          if (compilationState.type !== "PENDING") {
            handleInvocation(
              invocation,
              getHandlers,
              compilationState.err,
              compilationState.stats
            );
          } else {
            compilationState.queuedInvocations.push(invocation);
          }
        })) as unknown) as Handlers[typeof key],
    getProperty: (key) => getHandlers()[key],
    proxy: makeProxy(getHandlers),
  };
};

/**
 * Make a handler from a prebuilt module
 * @param module
 */
export const makeStaticHandlers = <
  Handlers extends Record<string | number | symbol, unknown>
>(
  getModule: () => Handlers
): HotHandlers<Handlers> => {
  const module = getModule();
  return {
    getHandler: (key) => module[key],
    getProperty: (key) => module[key],
    proxy: makeProxy(() => module),
  };
};

/**
 * Build a static handler
 * @param env
 */
export const buildHandler = async (config: Configuration): Promise<void> => {
  const compiler = webpack(config);
  compiler.run((err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if ("details" in err) {
        console.error((err as Error & { details: string }).details);
      }
      throw err;
    }
    if (!stats) {
      throw new Error("missing stats");
    }
    const info = stats.toJson(statsOptions);
    info.warnings?.forEach((warning) => {
      console.warn(warning);
    });
    info.errors?.forEach((error) => {
      console.error(error);
    });
    if (stats.hasErrors()) {
      throw new Error("Failed to build due to errors");
    }
  });
};
