import vm from "node:vm";
import * as ts from "typescript";
import { type ReactNode, createElement } from "react";
// import { type ClientComponent } from "./component-libraries";
import { Fragment } from "react";

// JSX is transformed to JSX_FACTORY_NAME() calls.
const JSX_FACTORY_NAME = "___$rs$jsx";

type ClientComponentId = string;
type ClientComponentBundlePath = string;
type ClientComponentNamedExportName = string;
// ClientComponentMetadata are used to fetch and mount the component on the client.
// Note for future reference:
//     it seems that newer version of `react-server-dom-webpack`
//     use an array format rather than objects:
//     [id, chunks, name, async]
type ClientComponentMetadata = {
  id: ClientComponentBundlePath;
  name: ClientComponentNamedExportName;
  chunks: [];
  async: true;
};

export type ClientComponentsWebpackManifest = Record<
  ClientComponentId,
  ClientComponentMetadata
>;

export const transformJsx = (jsx: string): string =>
  ts.transpileModule(jsx, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      jsxFactory: JSX_FACTORY_NAME,
    },
  }).outputText;

/**
 * Custom createElement that deletes non-serializable props.
 * Currently it only removes function props - these cannot be passed from server components to client components.
 * @todo research what React uses when serializing and model this implementation based on that.
 */
const createElement_serverSafe = (
  ...args: Parameters<typeof createElement>
): ReturnType<typeof createElement> => {
  const [type, props, ...children] = args;

  if (props == null) {
    return createElement(...args);
  }

  for (const name in props) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore this is fine
    if (typeof props[name] === "function") {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore this is fine
      delete props[name];
    }
  }

  return createElement(type, props, ...children);
};

const UnsupportedComponent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return createElement_serverSafe(
    "div",
    {
      // @ts-expect-error not every component supports className but that's ok.
      className,
    },
    children,
  );
};

export const evaluateReact = <ClientComponentsName extends string>(
  sourceCode: string,
  // clientComponents: Record<ClientComponentsName, ClientComponent>,
  clientComponents: Record<ClientComponentsName, any>,
  clientComponentsWebpackManifest: ClientComponentsWebpackManifest,
) => {
  const script = new vm.Script(sourceCode);

  const staticContext = {
    [JSX_FACTORY_NAME]: createElement_serverSafe,
    Fragment,
    Array,
    String,
    Number,
    BigInt,
    Boolean,
    Object,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Date,
    Intl,
    Math,
    RegExp,
    JSON,
    Symbol,
    Infinity,
    Error,
    URL,
    Promise,
    escape,
    unescape,
    isNaN,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    parseInt,
    parseFloat,
    console,
  };

  const context = new Proxy(staticContext, {
    get(target, prop, receiver) {
      if (
        typeof prop === "string" &&
        !(prop in staticContext) &&
        /^[A-Z]/.test(prop)
      ) {
        if (prop in clientComponents) {
          const component = clientComponents[prop as ClientComponentsName];

          if (component.$$id in clientComponentsWebpackManifest === false) {
            // @todo probably we can use ReactServerDOM.createClientModuleProxy(component.$$path)
            // revisit this part when implementing building for UI libraries / design systems.
            // [id, chunks, name, async]
            // clientComponentsWebpackManifest[component.$$id] = [component.$$id, [], prop, true];
            clientComponentsWebpackManifest[component.$$id] = {
              id: component.$$id,
              // Use the detected export name
              name: prop,
              // Turn off chunks. This is webpack-specific
              chunks: [],
              // Use an async import for the built resource in the browser
              async: true,
            };
          }

          return component;
        }

        // 1. The LLM has only streamed part of a supported component eg. <Compon
        // 2. The component is actually not supported eg. <NotSupported />
        return UnsupportedComponent;
      }

      return Reflect.get(target, prop, receiver);
    },
  });

  // @todo check if this can be sandboxed further.
  vm.createContext(context);

  return script.runInContext(context);
};
