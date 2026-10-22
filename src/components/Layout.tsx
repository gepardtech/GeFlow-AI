import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { AnnouncementBar } from "./AnnouncementBar";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1">
      {children}
    </main>
    <AnnouncementBar audience="public" position="bottom" />
    <Footer />
  </div>
);

export default Layout;
