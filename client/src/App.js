import { SnackbarProvider } from "notistack";
import "./App.css";
import Main from "./Main";

function App() {
  return (
    <div className="App">
      <SnackbarProvider>
        <Main />
      </SnackbarProvider>
    </div>
  );
}

export default App;
