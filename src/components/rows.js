import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shortDate } from '../logic';
import { useData } from '../data';
import { useTheme } from '../theme';
import { Amount, Button, Chip, Row } from './ui';

const STATUS_LABEL = { overdue: 'Overdue', upcoming: 'Upcoming', paid: 'Paid' };

export function BillRow({ item, last, editable }) {
  const { today, openSheet } = useData();
  const t = useTheme();
  const { bill, status, dueDate, daysLeft } = item;
  const label =
    status === 'due-soon' ? (daysLeft === 0 ? 'Due today' : `In ${daysLeft} day${daysLeft > 1 ? 's' : ''}`) : STATUS_LABEL[status];
  return (
    <Row
      title={bill.name}
      last={last}
      meta={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Chip label={label} tone={status} />
          <Text style={{ color: t.muted, fontSize: 12 }}>
            {status === 'paid' ? 'next' : 'due'} {shortDate(dueDate, today)}
          </Text>
        </View>
      }
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Amount value={bill.amount} />
            {status !== 'paid' && <Button small kind="secondary" title="Mark paid" onPress={() => openSheet('payBill', { billId: bill.id })} />}
          </View>
          {editable && (
            <Pressable onPress={() => openSheet('bill', { billId: bill.id })} hitSlop={10} accessibilityLabel={`Edit ${bill.name}`}>
              <Ionicons name="create-outline" size={20} color={t.muted} />
            </Pressable>
          )}
        </View>
      }
    />
  );
}
