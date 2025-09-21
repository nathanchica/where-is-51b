import { print } from 'graphql';
import { createClient as createSSEClient } from 'graphql-sse';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { cacheExchange, createClient, fetchExchange, Provider, subscriptionExchange } from 'urql';

import './index.css';
import App from './App';

const GRAPHQL_HTTP_URL = import.meta.env.VITE_GRAPHQL_HTTP_URL ?? 'http://localhost:4000/graphql';
const GRAPHQL_SSE_URL = import.meta.env.VITE_GRAPHQL_SSE_URL ?? GRAPHQL_HTTP_URL;

const sseClient =
    typeof window !== 'undefined'
        ? createSSEClient({
              url: GRAPHQL_SSE_URL,
          })
        : null;

const client = createClient({
    url: GRAPHQL_HTTP_URL,
    exchanges: [
        cacheExchange,
        ...(sseClient
            ? [
                  subscriptionExchange({
                      forwardSubscription(operation) {
                          return {
                              subscribe(sink) {
                                  const { query } = operation;
                                  if (!query) {
                                      throw new Error('Missing GraphQL document for subscription operation.');
                                  }

                                  const serializedQuery = typeof query === 'string' ? query : print(query);

                                  const dispose = sseClient.subscribe(
                                      {
                                          ...operation,
                                          query: serializedQuery,
                                      },
                                      sink
                                  );

                                  return {
                                      unsubscribe: dispose,
                                  };
                              },
                          };
                      },
                  }),
              ]
            : []),
        fetchExchange,
    ],
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider value={client}>
            <App />
        </Provider>
    </StrictMode>
);
