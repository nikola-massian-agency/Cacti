/* 12. LOADING UI — minimal, black, fades out once the first chunk is
   playable. Deliberately NOT tied to the full 85 MB download. */

export default function LoadingOverlay({
  visible,
  percent,
}: {
  visible: boolean;
  percent: number;
}) {
  return (
    <div className={`loader${visible ? "" : " loaderHidden"}`} aria-hidden={!visible}>
      <div className="loaderWord">Loading</div>
      <div className="loaderPct">{percent}%</div>
    </div>
  );
}
