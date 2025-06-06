import Page from "./app/page";
import { ThemeProvider } from "@/components/theme-provider"; // adjust the path if needed

function App() {
  return (
    <div id="app-wrapper">
      <ThemeProvider>
        <main className="flex flex-col items-center justify-center h-full">
          <Page />
        </main>
      </ThemeProvider>
    </div>
  );
}



export default App;
