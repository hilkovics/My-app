import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { ACTIVITY_COLORS, FontFamily, Viz } from '@/constants/theme';
import { arcPath, hitTestRing, polar, splitAt } from '@/features/plan/geometry';
import { entityColor } from '@/features/plan/entity-color';
import type { DayPlan, RadialPosition } from '@/features/plan/layout';
import { useTheme } from '@/hooks/use-theme';
import { hexA } from '@/lib/color';

/**
 * 24-hour ring ("Prstenec dňa"): midnight at the top, 15° per hour, clockwise.
 * - track under everything, sleep arc in `text2` at 28 %
 * - block arcs with a 2 px gap: deep = mark, routine = mark 50 %, pause = success 55 %,
 *   event = categorical colour, tentative = dashed, over capacity = 3 px danger arc just outside
 * - 2 px separators (card colour) at 0/6/12/18, tick labels outside
 * - inner day-progress ring (3 px, text2 18 % track, 70 % progress) and, 8 px further in, the
 *   actual-work ring (4 px, mark); the dot marks "now"
 * - past parts of today's arcs are at 30 %; focus mode dims everything but the current block to 12 %
 *   and gives it a glow (the same arc, stroke + 14, mark 30 %)
 * `size` 300 is the plan screen; the compact 116 variant has no tick labels.
 */
export function DayRing({
  plan,
  size = Viz.ring.sizeLarge,
  elapsedAngle,
  workArcs = [],
  selectedKey = null,
  focusKey = null,
  compact = false,
  onSelect,
  label,
  children,
  under,
}: {
  plan: DayPlan;
  size?: number;
  /** Angle of "now" (today), 360 for a past day, null for a future day. */
  elapsedAngle: number | null;
  workArcs?: RadialPosition[];
  selectedKey?: string | null;
  /** Focus mode: everything but this entry is dimmed. */
  focusKey?: string | null;
  compact?: boolean;
  onSelect?: (key: string) => void;
  label: string;
  children?: ReactNode;
  /** Colour behind the ring (separators, now-dot outline). Defaults to the card colour. */
  under?: string;
}) {
  const theme = useTheme();
  const cardColor = under ?? theme.surface;
  const pad = compact ? 4 : Viz.ring.tickPad;
  const w = size * 0.12;
  const c = size / 2;
  const r = c - pad - w / 2;
  const gapDeg = ((Viz.ring.gapPx / (2 * Math.PI * r)) * 360);
  const rProgress = r - w / 2 - 7;
  const rWork = rProgress - 8;
  const focusing = focusKey != null;
  const dim = (key: string) => (focusing && focusKey !== key ? 0.12 : 1);
  const nowPoint = elapsedAngle != null && elapsedAngle < 360 ? polar(c, c, r, elapsedAngle) : null;

  return (
    <Pressable
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={label}
      accessibilityRole={onSelect ? 'button' : 'image'}
      disabled={!onSelect}
      onPress={(e) => {
        // Tapping an arc selects its entry (computed from the touch point, no SVG event handlers needed).
        const { locationX, locationY } = e.nativeEvent;
        const key = hitTestRing(
          plan.entries.flatMap((en) => (en.radial_position ? [{ key: en.key, ...en.radial_position }] : [])),
          { cx: c, cy: c, r, width: w, x: locationX, y: locationY },
        );
        if (key) onSelect?.(key);
      }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={c} cy={c} r={r} stroke={theme.track} strokeWidth={w} fill="none" />

          {plan.sleep.map((a, i) => (
            <Path
              key={`sleep${i}`}
              d={arcPath(c, c, r, a.start_angle, a.end_angle)}
              stroke={theme.sleepArc}
              strokeWidth={w}
              fill="none"
              opacity={focusing ? 0.3 : 1}
            />
          ))}

          {plan.entries.map((e) => {
            const rp = e.radial_position;
            if (!rp || rp.end_angle <= rp.start_angle) return null;
            const v = e.visual_intensity;
            const isEvent = e.kind === 'event' || e.kind === 'external';
            const base = isEvent ? entityColor(e.id, e.color, ACTIVITY_COLORS[theme.mode]) : v.energy === 'rest' ? theme.success : theme.mark;
            const alpha = (isEvent || v.energy === 'deep' ? 1 : v.energy === 'rest' ? 0.55 : 0.5) * dim(e.key);
            const trim = rp.end_angle - rp.start_angle > gapDeg * 3 ? gapDeg / 2 : 0;
            const start = rp.start_angle + trim;
            const end = rp.end_angle - trim;
            const { past, future } = splitAt(start, end, elapsedAngle);
            const dash = e.tentative ? '6 4' : undefined;
            const common = { strokeWidth: w, fill: 'none' as const, strokeDasharray: dash };
            const current = focusing && focusKey === e.key;
            return (
              <G key={e.key}>
                {current ? (
                  <Path d={arcPath(c, c, r, rp.start_angle, rp.end_angle)} stroke={hexA(theme.mark, 0.3)} strokeWidth={w + Viz.ring.focusGlowExtra} strokeLinecap="round" fill="none" />
                ) : null}
                {past ? <Path d={arcPath(c, c, r, past[0], past[1])} stroke={hexA(base, alpha * 0.3)} {...common} /> : null}
                {future ? <Path d={arcPath(c, c, r, future[0], future[1])} stroke={hexA(base, alpha)} {...common} /> : null}
                {e.overflow ? (
                  <Path
                    d={arcPath(c, c, r + w / 2 + 4, rp.start_angle, rp.end_angle)}
                    stroke={theme.danger}
                    strokeWidth={Viz.ring.overOutlineStroke}
                    strokeLinecap="round"
                    fill="none"
                    opacity={dim(e.key)}
                  />
                ) : null}
                {selectedKey === e.key ? (
                  <Path d={arcPath(c, c, r + w / 2 + 1, rp.start_angle, rp.end_angle)} stroke={theme.text} strokeWidth={2} fill="none" />
                ) : null}
              </G>
            );
          })}

          {[0, 90, 180, 270].map((a) => {
            const p1 = polar(c, c, r - w / 2 - 1, a);
            const p2 = polar(c, c, r + w / 2 + 1, a);
            return <Line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={cardColor} strokeWidth={2} />;
          })}

          {elapsedAngle != null ? (
            <>
              <Circle cx={c} cy={c} r={rProgress} stroke={hexA(theme.text2, 0.18)} strokeWidth={Viz.ring.dayProgressStroke} fill="none" />
              {elapsedAngle > 0 ? (
                <Path d={arcPath(c, c, rProgress, 0, elapsedAngle)} stroke={hexA(theme.text2, 0.7)} strokeWidth={Viz.ring.dayProgressStroke} strokeLinecap="round" fill="none" />
              ) : null}
            </>
          ) : null}
          {workArcs.map((a, i) => (
            <Path key={`work${i}`} d={arcPath(c, c, rWork, a.start_angle, a.end_angle)} stroke={theme.mark} strokeWidth={Viz.ring.actualStroke} strokeLinecap="round" fill="none" />
          ))}

          {!compact
            ? [0, 6, 12, 18].map((h) => {
                const p = polar(c, c, c - pad / 2 + 1, h * 15);
                return (
                  <SvgText
                    key={h}
                    x={p.x}
                    y={p.y}
                    fontSize={11}
                    fontFamily={FontFamily[700]}
                    fill={theme.text2}
                    textAnchor="middle"
                    alignmentBaseline="central"
                    dy={4}>
                    {h}
                  </SvgText>
                );
              })
            : null}
          {nowPoint ? <Circle cx={nowPoint.x} cy={nowPoint.y} r={Math.max(5, w * 0.28)} fill={theme.text} stroke={cardColor} strokeWidth={2.5} /> : null}
        </Svg>
      </View>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
