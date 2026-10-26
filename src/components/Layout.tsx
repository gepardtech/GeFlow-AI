import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { AnnouncementBar } from "./AnnouncementBar";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none"
    >
      Skip to main content
    </a>
    <Navbar />
    <main id="main-content" className="flex-1" tabIndex={-1}>
      {children}
    </main>
    <AnnouncementBar audience="public" position="bottom" />
    <Footer />
  </div>
);

export default Layout;
