// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name: string;
};

export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

const messages =
  `Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet`.split(
    ".",
  );

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  // Respond right away
  res.write("Welcome.");

  for (const message of messages) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    res.write(message);
  }

  res.end("Goodbye");
}
