import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, Row } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { openCreated } from '@/features/templates/open';
import { applyTemplate, listTemplates, restoreSamples, type Template } from '@/features/templates/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { notify } from '@/lib/confirm';
import { describeRule, parseRule } from '@/lib/recurrence';

export default function TemplatesScreen() {
  const db = useDb();
  const theme = useTheme();
  const templates = useLiveQuery((d) => listTemplates(d), []);
  if (!templates) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  const restore = async () => {
    const n = await restoreSamples(db);
    notify(n ? t.templates.restored : t.templates.nothingToRestore);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      {templates.length ? templates.map((tpl) => <Row_ key={tpl.id} tpl={tpl} />) : <Empty text={t.templates.empty} />}
      <Button icon="add" label={t.templates.new} onPress={() => router.push('/templates/edit')} />
      <Button variant="secondary" label={t.templates.restore} onPress={() => void restore()} />
    </ScrollView>
  );
}

function Row_({ tpl }: { tpl: Template }) {
  const db = useDb();
  const rule = parseRule(tpl.rrule);
  return (
    <Card>
      <ThemedText type="smallBold" onPress={() => router.push({ pathname: '/templates/edit', params: { id: tpl.id } })} accessibilityRole="button">
        {tpl.icon} {tpl.name}
      </ThemedText>
      <ThemedText type="small" themeColor="text2">
        {t.templates[tpl.kind]}
        {rule ? ` · 🔁 ${describeRule(rule).toLowerCase()}` : ''}
      </ThemedText>
      <Row>
        <Button small label={t.templates.use} onPress={() => void applyTemplate(db, tpl).then(openCreated)} />
        <Button small variant="secondary" label={t.common.edit} onPress={() => router.push({ pathname: '/templates/edit', params: { id: tpl.id } })} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
