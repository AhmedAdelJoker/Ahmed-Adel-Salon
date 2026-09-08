import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";

export function ProbeTest() {
  try {
    doSomething();
  } catch (error) {
    console.error("oops", error);
  }
  try {
    doOther();
  } catch (e) {
    console.error("oops2", e);
  }
  return (
    <Button>
      <Badge>hi</Badge>
      <Card>
        <CardContent>x</CardContent>
      </Card>
      <AnimatePresence>y</AnimatePresence>
    </Button>
  );
}

function doSomething() {}
function doOther() {}
