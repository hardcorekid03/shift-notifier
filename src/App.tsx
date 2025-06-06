import Page from "./app/page";
import { ThemeProvider } from "@/components/theme-provider"; // adjust the path if needed

function App() {
  return (
    <ThemeProvider>
      <main className="flex flex-col items-center justify-center h-screen">
        <Page />
      </main>
    </ThemeProvider>
  );
}

export default App;
