/**
 * The workspace background as absolute layers filling the nearest positioned ancestor (0.7.0-dev.7). Put it first in a
 * `relative` container and give the content after it `relative` too, so it paints above.
 */
import * as React from "react";
import { useTheme } from "./ThemeProvider";
import { colorBackground, imageLayerStyle, imageOverlayStyle, isImageBackground, type WorkspaceBackground } from "./workspaceBackground";

export interface WorkspaceBackdropProps {
  bg: WorkspaceBackground;
  /** Default: the ThemeProvider's theme. */
  isDark?: boolean;
  /** Replaces the colour layers' opaque base, e.g. "transparent" over a surface that paints its own (the dark aurora). */
  base?: string;
  className?: string;
}

export const WorkspaceBackdrop = React.memo(function WorkspaceBackdrop({ bg, isDark: isDarkProp, base, className }: WorkspaceBackdropProps) {
  const theme = useTheme();
  const isDark = isDarkProp ?? theme.isDark;
  const image = isImageBackground(bg);
  const layer = React.useMemo(() => (image ? imageLayerStyle(bg, isDark) : { background: colorBackground(bg, isDark, base) }), [bg, image, isDark, base]);
  const overlay = React.useMemo(() => imageOverlayStyle(bg, isDark), [bg, isDark]);
  return (
    <div className={["pointer-events-none absolute inset-0 overflow-hidden", className].filter(Boolean).join(" ")} aria-hidden data-sf-backdrop="">
      <div className="absolute inset-0" style={layer} />
      {image && <div className="absolute inset-0" style={overlay} />}
    </div>
  );
});
