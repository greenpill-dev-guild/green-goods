import { getIndexerUrl } from "@green-goods/shared/config";
import { createUrqlClient } from "@green-goods/shared/utils/urql";
import { RouterProvider } from "react-router-dom";
import { Provider as UrqlProvider } from "urql";
import { router } from "@/router";

function App() {
  const urqlClient = createUrqlClient(getIndexerUrl(import.meta.env, import.meta.env.DEV));

  return (
    <UrqlProvider value={urqlClient}>
      <RouterProvider router={router} />
    </UrqlProvider>
  );
}

export default App;
