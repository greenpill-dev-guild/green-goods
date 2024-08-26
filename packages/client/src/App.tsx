import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import viteLogo from "/vite.svg";

function App() {
  const [count, setCount] = useState(0);

  const { login, logout } = usePrivy();

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
        <button onClick={login}>Login</button>
        <button onClick={logout}>Logout</button>
      </div>
    </>
  );
}

export default App;
