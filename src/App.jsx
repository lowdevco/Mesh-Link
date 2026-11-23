import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PwaStatus from "@/components/PwaStatus";
import ServerWake from "@/components/ServerWake";
import HomePage from "@/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";
import PageSkeleton from "@/components/PageSkeleton";
import { Toaster } from "@/components/ui/sonner";

// Split per page: Send/Receive pull in WebRTC, dialogs and OTP input that the landing page doesn't need.
const SendPage = lazy(() => import("@/pages/SendPage"));
const ReceivePage = lazy(() => import("@/pages/ReceivePage"));

export default function App() {
  return (
    <BrowserRouter>
      <>
        <div className="flex min-h-dvh flex-col">
          <Navbar />
          <PwaStatus />
          <ServerWake />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/send" element={<SendPage />} />
                <Route path="/receive" element={<ReceivePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
        <Toaster position="bottom-right" />
      </>
    </BrowserRouter>
  );
}
