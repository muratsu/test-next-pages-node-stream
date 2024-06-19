import { useState, useEffect } from "react";
import { flushSync } from "react-dom";

export default function Home() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const abortController = new AbortController();

    (async () => {
      const response = await fetch("/api/pages-route-web", {
        signal: abortController.signal,
      });

      const reader = response.body?.getReader();

      console.log(response);
      console.log(typeof response.body, typeof response.body?.getReader);

      if (abortController.signal.aborted) return;

      if (!response.ok || !reader) {
        setMessage("Something went wrong");
        return;
      }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();

        if (done || abortController.signal.aborted) break;

        flushSync(() => {
          setMessage((message) => message + decoder.decode(value));
        });
      }
    })();

    return () => {
      abortController.abort("React running effects twice in dev lol");
    };
  }, []);

  return <p>{message}</p>;
}
