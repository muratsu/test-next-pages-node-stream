"use server";
import { renderToReadableStream } from "react-server-dom-webpack/server.edge";
import { getTestAIStream, tests } from "@/test-stream-responses";
import { createStreamableValue } from "ai/rsc";
import {
  type ClientComponentsWebpackManifest,
  transformJsx,
  evaluateReact,
} from "./compiler";

function sourceWithStylesheets(source: string, stylesheets: string[]) {
  return `<Fragment>${stylesheets.map((stylesheet) => `<link rel="stylesheet" href="${stylesheet}" />`).join("\n")}${source}`;
}

export async function generate() {
  const clientComponentsWebpackManifest: ClientComponentsWebpackManifest = {};
  const stylesheets: string[] = [];
  const clientComponents: any = [];
  // const testStream = getTestAIStream(tests.simplePage);

  const renderReadableStream: ReadableStream = renderToReadableStream(
    evaluateReact(
      transformJsx(sourceWithStylesheets(tests.justHTML, stylesheets)),
      clientComponents,
      clientComponentsWebpackManifest
    ),
    clientComponentsWebpackManifest
  );

  const uiStream = createStreamableValue("");

  renderReadableStream
    .pipeTo(
      new WritableStream({
        start: () => {
          uiStream.update("");
        },
        write: async (message) => {
          const chunk = new TextDecoder("utf-8").decode(message);
          console.log("chunk:" + new TextDecoder("utf-8").decode(message));
          uiStream.append(chunk);
        },
        close: () => {
          console.log("done");
          uiStream.done();
        },
      })
    )
    .catch((e) => {
      console.log(`err:${e}`);
      uiStream.error;
    });

  return { output: uiStream.value };
}
