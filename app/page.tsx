"use client";

import { useState, useEffect, useTransition, use } from "react";
import { generate } from "./generate";
import { readStreamableValue } from "ai/rsc";
import { ErrorBoundary } from "react-error-boundary";
// @ts-expect-error TODO: Fix later
import { createFromReadableStream } from "react-server-dom-webpack/client";

export const maxDuration = 240;

export default function Page() {
  const [isPending, startTransition] = useTransition();
  const [appState, setAppState] = useState<{
    isPending: boolean;
    rscPayload: string;
  }>({ isPending: false, rscPayload: "" });

  useEffect(() => {
    async function fetchData() {
      try {
        const { output } = await generate();

        let currentGeneration = "";
        for await (const delta of readStreamableValue(output)) {
          currentGeneration = `${currentGeneration}${delta}`.replaceAll(
            "```",
            ""
          );
          // console.log(`current generation: ${currentGeneration}`);

          setAppState({
            isPending: true,
            rscPayload: currentGeneration,
          });
        }

        setAppState({ ...appState, isPending: false });
      } catch (error) {
        console.log(error);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="overflow-y-auto max-h-[500px] min-h-96 bg-white dark:text-black dark:bg-slate-900 rounded-lg p-4">
      <ErrorBoundary fallback={<p>Error</p>} key={appState?.rscPayload ?? ""}>
        <RenderRscPayload
          rscPayload={getValidRscPayloadFromPartial(appState?.rscPayload ?? "")}
        />
      </ErrorBoundary>
    </div>
  );
}

function isValidRscPayload(rscText: string) {
  console.log(`check: ${rscText}`);
  if (!rscText.startsWith("0:")) {
    return false;
  }

  if (!rscText.endsWith("\n")) {
    return false;
  }

  return true;
}

function insertSuspenseBoundaries(rscPayload: string) {
  // Find unresolved line refenreces
  const lineReferences = [...rscPayload.matchAll(/\$L\d{1,2}/g)].map((a) =>
    a["0"].replace("$L", "")
  );
  const lines = rscPayload
    .split("\n")
    .map((line) => line.split(":").at(0))
    .filter((line) => line !== "");

  const unresolvedLineRefereces = [];
  for (const lineReference of lineReferences) {
    // Try to find the line reference among the lines
    if (!lines.includes(lineReference)) {
      unresolvedLineRefereces.push(lineReference);
    }
  }

  function createSuspenseBoundary(lineReference: string) {
    const boundary = `["$","$a",null,{"fallback":["$","p",null,{"children":"Generating..."}],"children":"$L${lineReference}"}]`;

    return boundary;
  }

  const suspenseSymbolLine = `a:"$Sreact.suspense"`;

  let clonedPayload = `${rscPayload}`;
  // Find unresolved references and add suspense boundaries
  for (const unresolvedLineReference of unresolvedLineRefereces) {
    clonedPayload = clonedPayload.replace(
      new RegExp(String.raw`"\$L${unresolvedLineReference}"`, "g"),
      createSuspenseBoundary(unresolvedLineReference)
    );
  }

  return `${suspenseSymbolLine}\n${clonedPayload}`;
}

async function createRscStream(rscPayload: string) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(rscPayload));
    },
  });

  return createFromReadableStream(stream);
}

const promiseCache = new Map<string, Promise<any>>();

function RenderRscPayload({ rscPayload }: { rscPayload: string | null }) {
  if (rscPayload === null) {
    return <span>loading...</span>;
  }

  if (!isValidRscPayload(rscPayload)) {
    return <span>loading...</span>;
  }

  const rscPayloadWithSuspenseBoundaries = insertSuspenseBoundaries(rscPayload);

  let promiseCacheValue = promiseCache.get(rscPayloadWithSuspenseBoundaries);

  if (promiseCacheValue === undefined) {
    promiseCacheValue = createRscStream(rscPayloadWithSuspenseBoundaries);
    promiseCache.set(rscPayloadWithSuspenseBoundaries, promiseCacheValue);
  }

  return <div className="w-full min-w-full">{use(promiseCacheValue)}</div>;
}

function getValidRscPayloadFromPartial(partialRscPayload: string | null) {
  if (partialRscPayload === null) {
    return partialRscPayload;
  }

  const splitByNewLines = partialRscPayload.split("\n");

  if (splitByNewLines.length === 0 || splitByNewLines.length === 1) {
    return partialRscPayload;
  }

  // Return every array item except the last one and join
  splitByNewLines.pop();
  return splitByNewLines.join("\n") + "\n";
}
