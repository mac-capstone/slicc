import { Input, Text, View } from '@/components/ui';
import { type translate } from '@/lib';
import { sanitizeNumeric } from '@/lib/settings-screen-helpers';

export function SectionTitle({ tx }: { tx: Parameters<typeof translate>[0] }) {
  return (
    <Text
      tx={tx}
      className="text-xs uppercase tracking-widest text-charcoal-400"
    />
  );
}

export function SectionDivider() {
  return <View className="mt-8 border-b border-charcoal-800" />;
}

export function InlinePercentRow({
  labelTx,
  value,
  onChangeText,
  onSubmit,
  error,
  testID,
}: {
  labelTx: Parameters<typeof translate>[0];
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  error?: string | null;
  testID: string;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between gap-4">
        <Text tx={labelTx} className="shrink text-base text-text-50" />
        <Input
          testID={testID}
          compact
          keyboardType="decimal-pad"
          returnKeyType="done"
          value={value}
          onChangeText={(text) => onChangeText(sanitizeNumeric(text))}
          onBlur={onSubmit}
          onSubmitEditing={onSubmit}
          placeholder="0"
          containerClassName="mb-0 w-24 shrink-0"
          inputClassName="border-charcoal-500 bg-charcoal-900 font-futuraDemi text-right text-lg text-text-50"
          style={{ textAlign: 'right' }}
        />
      </View>
      {error ? (
        <Text className="mt-2 text-sm text-danger-400">{error}</Text>
      ) : null}
    </View>
  );
}
