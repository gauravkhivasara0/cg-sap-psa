const cds = require('@sap/cds');
const { SELECT, INSERT } = cds.ql;

// In-app notifications (FR-009 / INT-05). E-mail delivery is not wired yet;
// rows stay in delivery_status 'Pending' until a provider is configured.

const notify = async (tx, { recipientID, eventType, subject, message, entity, recordID, key }) => {
  if (!recipientID) return;
  const { Notifications } = cds.entities('psa');
  await tx.run(INSERT.into(Notifications).entries({
    recipient_ID: recipientID,
    event_type: eventType,
    subject,
    message,
    related_entity: entity,
    related_record_id: recordID,
    deduplication_key: key || null
  }));
};

/** Same as notify, but only once per deduplication key (e.g. one alert per threshold crossing). */
const notifyOnce = async (tx, n) => {
  const { Notifications } = cds.entities('psa');
  const exists = await tx.run(SELECT.one.from(Notifications).columns('ID').where({ deduplication_key: n.key }));
  if (!exists) await notify(tx, n);
};

module.exports = { notify, notifyOnce };
