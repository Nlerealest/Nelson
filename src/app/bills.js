import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { billSchedule, formatKwacha as K } from '../logic';
import { useData } from '../data';
import { getReminderPermission, remindersSupported, requestReminderPermission, scheduleReminders } from '../reminders';
import { Alert, Body, Button, Card, Empty, H1, Screen, Tiles, Actions } from '../components/ui';
import { BillRow } from '../components/rows';

export default function Bills() {
  const { data, today, openSheet, toast } = useData();
  const [permission, setPermission] = useState(null);
  useFocusEffect(
    useCallback(() => {
      getReminderPermission().then(setPermission);
    }, []),
  );

  const schedule = billSchedule(data.bills, today);
  const unpaid = schedule.filter((s) => s.status !== 'paid').reduce((a, s) => a + s.bill.amount, 0);

  return (
    <Screen>
      <H1>Bills & reminders</H1>
      <Tiles
        items={[
          { label: 'Monthly bills', value: K(data.bills.reduce((a, b) => a + b.amount, 0)) },
          { label: 'Still to pay this month', value: K(unpaid), tone: unpaid ? 'danger' : 'primary' },
        ]}
      />
      {!remindersSupported && (
        <Alert level="info">Phone reminders for bills work in the installed Ndalama app. They are switched off while testing in Expo Go.</Alert>
      )}
      {remindersSupported && permission && permission !== 'granted' && (
        <Alert level="info">
          <Body>Get a reminder on your phone the day before and the day a bill is due.</Body>
          <Actions>
            <Button
              small
              kind="secondary"
              icon="notifications-outline"
              title="Turn on reminders"
              onPress={async () => {
                const status = await requestReminderPermission();
                setPermission(status);
                toast(status === 'granted' ? 'Bill reminders turned on' : 'Allow notifications for Ndalama in your phone settings');
                scheduleReminders(data, today);
              }}
            />
          </Actions>
        </Alert>
      )}
      <Card>
        {schedule.length ? (
          schedule.map((s, i) => <BillRow key={s.bill.id} item={s} editable last={i === schedule.length - 1} />)
        ) : (
          <Empty>Add rent, ESCOM, water, school fees or any bill you pay every month. We will remind you before it is due.</Empty>
        )}
      </Card>
      <Button block title="+ New bill" onPress={() => openSheet('bill')} />
    </Screen>
  );
}
