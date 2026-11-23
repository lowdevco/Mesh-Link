import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Download, Send, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 [&_svg]:size-6">
            <Unplug />
          </EmptyMedia>
          <p className="font-mono text-sm text-brand">404</p>
          <EmptyTitle className="text-2xl font-semibold tracking-tight">This link goes nowhere</EmptyTitle>
          <EmptyDescription>
            There's no page at <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{pathname}</code>.
            If someone shared a room with you, open Receive and enter their code.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/receive">
                <Download /> Receive files
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/send">
                <Send /> Send files
              </Link>
            </Button>
          </div>
          <Button asChild variant="link" className="text-muted-foreground">
            <Link to="/">
              <ArrowLeft /> Back home
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
