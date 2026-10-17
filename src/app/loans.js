import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatKwacha as K, loanStatus, loansSummary, shortDate } from '../logic';
import { useData } from '../data';
import { Actions, Amount, Bar, Body, Button, Card, Chip, Empty, H1, H2, Row, Screen, Segmented, Tiles } from '../components/ui';

function LoanCard({ loan }) {
  const { today, openSheet } = useData();
  const [showRepayments, setShowRepayments] = useState(false);
  const st = loanStatus(loan, today);
  const lent = loan.direction === 'lent';
  const repayments = loan.repayments || [];
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <H2>{loan.person}</H2>
          <Body muted small>
            {lent ? 'Owes you' : 'You owe'} · since {shortDate(loan.date, today)}
          </Body>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Amount value={st.outstanding} tone={lent ? 'primary' : 'danger'} size={18} />
          <Body muted small>of {K(loan.amount)}</Body>
        </View>
      </View>
      <Bar fraction={loan.amount ? st.repaid / loan.amount : 0} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {st.settled ? (
          <Chip label="Settled" />
        ) : st.overdue ? (
          <Chip label={`Overdue since ${shortDate(loan.dueDate, today)}`} tone="overdue" />
        ) : (
          <Body muted small>{loan.dueDate ? `Due ${shortDate(loan.dueDate, today)}` : 'No due date'}</Body>
        )}
        {loan.note ? <Body muted small>· {loan.note}</Body> : null}
      </View>
      {repayments.length > 0 && (
        <Pressable onPress={() => setShowRepayments(!showRepayments)} style={{ marginTop: 6 }}>
          <Body muted small>
            {showRepayments ? '▾' : '▸'} {repayments.length} repayment{repayments.length > 1 ? 's' : ''}
          </Body>
        </Pressable>
      )}
      {showRepayments &&
        repayments.map((r, i) => (
          <Row key={i} meta={shortDate(r.date, today)} right={<Amount value={r.amount} />} last={i === repayments.length - 1} />
        ))}
      <Actions>
        {!st.settled && <Button small title="Record repayment" onPress={() => openSheet('repay', { loanId: loan.id })} />}
        <Button
          small
          kind="ghost"
          title="Delete"
          onPress={() =>
            openSheet('confirm', {
              title: 'Delete loan?',
              message: `The record for ${loan.person} will be removed. Linked income and expense entries stay.`,
              action: 'deleteLoan',
              id: loan.id,
            })
          }
        />
      </Actions>
    </Card>
  );
}

export default function Loans() {
  const { data, today, openSheet } = useData();
  const [filter, setFilter] = useState('open');
  const s = loansSummary(data.loans, today);
  const list = data.loans
    .map((loan) => ({ loan, st: loanStatus(loan, today) }))
    .filter(({ st }) => (filter === 'open' ? !st.settled : st.settled))
    .sort((a, b) => Number(b.st.overdue) - Number(a.st.overdue) || (a.loan.dueDate || '9').localeCompare(b.loan.dueDate || '9'));

  return (
    <Screen>
      <H1>Loans & debts</H1>
      <Tiles
        items={[
          { label: 'People owe me', value: K(s.owedToMe), tone: 'primary' },
          { label: 'I owe', value: K(s.iOwe), tone: s.iOwe ? 'danger' : undefined },
        ]}
      />
      <View style={{ marginBottom: 12 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            ['open', 'Open'],
            ['done', 'Settled'],
          ]}
        />
      </View>
      {list.length ? (
        list.map(({ loan }) => <LoanCard key={loan.id} loan={loan} />)
      ) : (
        <Card>
          <Empty>
            {filter === 'open'
              ? 'No open loans. Record money you lend to friends and relatives, or money you borrow, so nothing is forgotten.'
              : 'No settled loans yet.'}
          </Empty>
        </Card>
      )}
      <Actions>
        <Button title="+ I lent money" style={{ flex: 1 }} onPress={() => openSheet('loan', { direction: 'lent' })} />
        <Button kind="secondary" title="+ I borrowed" style={{ flex: 1 }} onPress={() => openSheet('loan', { direction: 'borrowed' })} />
      </Actions>
    </Screen>
  );
}
