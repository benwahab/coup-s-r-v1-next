import { useBetFlow } from "./context";
import { Card, Footer } from "./atoms";

export function StepPicks() {
  const { renderSelection, canContinue, goBackFrom, goNextFrom } = useBetFlow();
  return (
    <Card>
      {renderSelection}
      <Footer onBack={() => goBackFrom(1)} onNext={() => goNextFrom(1)} disabled={!canContinue} />
    </Card>
  );
}
