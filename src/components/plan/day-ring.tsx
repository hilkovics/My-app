import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { arcPath, hitTestRing, polar, splitAt } from '@/features/plan/geometry';
import type { DayPlan, RadialPosition } from '@/features/plan/layout';
import { hexA } from '@/lib/color';

/**
 * 24-hour ring: midnight at the top, 15° per hour, clockwise.
 * - outer ring: tasks and events as arcs (strong = deep work, muted = routine, grey-green = break,
 *   dashed = tentatively placed task, red outline outside = beyond the day's capacity)
 * - grey arc: sleep
 * - thin inner ring: how much of the day has passed; accent ring inside it: really worked time
 * - parts of arcs that are already behind us are faded ("cleaned"), the dot marks now
 */
export function DayRing({
  plan,
  size = 260,
  elapsedAngle,
  workArcs = [],
  selectedKey = null,
  focusKey = null,
  compact = false,
  onSelect,
  label,
  children,
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
}) {
  const theme = useTheme();
  const margin = compact ? 6 : 20;
  const w = size * (compact ? 0.13 : 0.1);
  const c = size / 2;
  const r = c - margin - w / 2;
  const rProgress = r - w / 2 - 5;
  const rWork = rProgress - 8;
  const dim = (key: string) => (focusKey != null && focusKey !== key ? 0.12 : 1);

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
        <Circle cx={c} cy={c} r={r} stroke={theme.surface2} strokeWidth={w} fill="none" />

        {plan.sleep.map((a, i) => (
          <Path key={`sleep${i}`} d={arcPath(c, c, r, a.start_angle, a.end_angle)} stroke={hexA(theme.text2, 0.28)} strokeWidth={w} fill="none" />
        ))}

        {plan.entries.map((e) => {
          const rp = e.radial_position;
          if (!rp || rp.end_angle <= rp.start_angle) return null;
          const hue = e.color ?? theme.accent;
          const v = e.visual_intensity;
          const stroke = v.energy === 'rest' ? theme.success : hue;
          const alpha = (v.energy === 'deep' ? 1 : v.energy === 'rest' ? 0.55 : 0.5) * dim(e.key);
          const { past, future } = splitAt(rp.start_angle, rp.end_angle, elapsedAngle);
          const dash = e.tentative ? '6 4' : undefined;
          const common = { strokeWidth: w, fill: 'none' as const, strokeDasharray: dash };
          return (
            <G key={e.key}>
              {past ? <Path d={arcPath(c, c, r, past[0], past[1])} stroke={hexA(stroke, alpha * 0.3)} {...common} /> : null}
              {future ? <Path d={arcPath(c, c, r, future[0], future[1])} stroke={hexA(stroke, alpha)} {...common} /> : null}
              {e.overflow ? (
                <Path d={arcPath(c, c, r + w / 2 + 3, rp.start_angle, rp.end_angle)} stroke={hexA(theme.danger, dim(e.key))} strokeWidth={3} fill="none" />
              ) : null}
              {selectedKey === e.key ? (
                <Path d={arcPath(c, c, r + w / 2 + 1, rp.start_angle, rp.end_angle)} stroke={theme.text} strokeWidth={2} fill="none" />
              ) : null}
            </G>
          );
        })}

        {elapsedAngle != null ? (
          <Path d={arcPath(c, c, rProgress, 0, elapsedAngle)} stroke={theme.text2} strokeWidth={3} strokeLinecap="round" fill="none" />
        ) : null}
        {workArcs.map((a, i) => (
          <Path key={`work${i}`} d={arcPath(c, c, rWork, a.start_angle, a.end_angle)} stroke={theme.accent} strokeWidth={4} fill="none" />
        ))}

        {!compact
          ? [0, 6, 12, 18].map((h) => {
              const p = polar(c, c, r + w / 2 + 11, h * 15);
              return (
                <SvgText key={h} x={p.x} y={p.y + 3.5} fontSize={10} fill={theme.text2} textAnchor="middle">
                  {h}
                </SvgText>
              );
            })
          : null}
        {[0, 90, 180, 270].map((a) => {
          const p1 = polar(c, c, r - w / 2, a);
          const p2 = polar(c, c, r + w / 2, a);
          return <Line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={theme.bg} strokeWidth={1.5} />;
        })}
        {elapsedAngle != null && elapsedAngle < 360 ? (
          <Circle cx={polar(c, c, r, elapsedAngle).x} cy={polar(c, c, r, elapsedAngle).y} r={w * 0.3 + 1} fill={theme.text} stroke={theme.bg} strokeWidth={2} />
        ) : null}
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
