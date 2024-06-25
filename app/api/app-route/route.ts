// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { getTestAIStream, tests } from "@/test-stream-responses";
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name: string;
};

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const messages =
  `Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet`.split(
    "."
  );

export async function GET() {
  const encoder = new TextEncoder();
  const reader = getTestAIStream(tests.simplePage).getReader()






  const customReadable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("Welcome"));

      for (const message of messages) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        controller.enqueue(encoder.encode(message));
      }

      controller.enqueue(encoder.encode("Goodbye"));

      controller.close();
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
