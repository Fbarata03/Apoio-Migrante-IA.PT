/**
 * Popula a base de dados com dados de demonstração.
 * Execute: node seed.js
 * Login demo: felicianoaa@email.pt / Demo1234!
 */
const bcrypt = require('bcryptjs');
const db     = require('./config/database');
require('dotenv').config();

async function seed() {
  console.log('\n🌱  A criar dados de demonstração...\n');
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Limpar dados anteriores do utilizador demo (se existir)
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute('DELETE FROM notifications WHERE user_id = 1');
    await conn.execute('DELETE FROM documents     WHERE user_id = 1');
    await conn.execute('DELETE FROM payments      WHERE user_id = 1');
    await conn.execute('DELETE FROM process_steps WHERE process_id IN (SELECT id FROM processes WHERE user_id = 1)');
    await conn.execute('DELETE FROM processes     WHERE user_id = 1');
    await conn.execute('DELETE FROM users         WHERE id = 1');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Utilizador demo
    const hash = await bcrypt.hash('Demo1234!', 10);
    await conn.execute(
      'INSERT INTO users (id, name, email, password_hash, phone, nationality) VALUES (1,?,?,?,?,?)',
      ['Feliciano Barata', 'felicianoaa@email.pt', hash, '+351 912 345 678', 'Angolana']
    );

    // Processo
    await conn.execute(`
      INSERT INTO processes
        (id, user_id, process_number, type, status, current_step, start_date, estimated_end_date)
      VALUES
        (1, 1, 'PT-2026-08431', 'Autorização de Residência', 'in_progress', 3, '2026-04-12', '2026-05-17')
    `);

    // Passos
    await conn.execute(`
      INSERT INTO process_steps
        (process_id, step_number, name, status, completed_date, estimated_days, detail)
      VALUES
        (1,1,'Registo',   'completed','2026-04-12 10:00:00',1,'12 abr'),
        (1,2,'Pagamento', 'completed','2026-04-18 14:30:00',3,'18 abr · €5'),
        (1,3,'Documentos','in_progress',NULL,10,'Em curso'),
        (1,4,'Análise IA','pending',NULL,5,'~5 dias'),
        (1,5,'Decisão',   'pending',NULL,7,'~22 maio')
    `);

    // Documentos de demonstração (sem ficheiro físico)
    await conn.execute(`
      INSERT INTO documents
        (id, process_id, user_id, document_type, original_name, stored_filename, file_path,
         mime_type, size_bytes, status, validated_at)
      VALUES
        (1,1,1,'Passaporte',
         'passaporte_frente_verso.pdf','demo_passport.pdf','uploads/demo_passport.pdf',
         'application/pdf',2457600,'approved','2026-04-22 09:15:00'),
        (2,1,1,'Comprovativo de Morada',
         'contrato_arrendamento.jpg','demo_contract.jpg','uploads/demo_contract.jpg',
         'image/jpeg',1843200,'processing',NULL),
        (3,1,1,'Declaração IRS',
         'declaracao_irs.pdf','demo_irs.pdf','uploads/demo_irs.pdf',
         'application/pdf',980000,'rejected','2026-04-23 11:30:00')
    `);
    await conn.execute(
      `UPDATE documents SET error_message=? WHERE id=3`,
      ['Documento ilegível na página 2. Recomendamos uma nova digitalização com mais resolução.']
    );

    // Pagamento (já pago no demo)
    await conn.execute(`
      INSERT INTO payments
        (id, process_id, user_id, description, amount, currency, status, method, due_date, paid_at)
      VALUES
        (1,1,1,'Taxa administrativa única',5.00,'EUR','paid','Cartão','2026-05-02','2026-04-18 14:30:00')
    `);

    // Notificações
    await conn.execute(`
      INSERT INTO notifications
        (user_id, type, title, message, is_read, priority, created_at)
      VALUES
        (1,'payment','Pagamento da taxa',
         'Para avançar para a fase de análise por IA, é necessário regularizar a taxa administrativa única.',
         FALSE,'high','2026-04-25 08:00:00'),
        (1,'document','Documento aprovado pela IA',
         'O seu passaporte foi validado em 2,3 segundos. Pode prosseguir.',
         FALSE,'medium','2026-04-25 03:00:00'),
        (1,'ai','IA otimizou o seu cronograma',
         'Estimativa atualizada: 22 dias (anterior: 28 dias).',
         FALSE,'low','2026-04-24 15:00:00'),
        (1,'official','Mensagem oficial do AIMA',
         'Candidatura recebida. Número de processo: PT-2026-08431',
         TRUE,'medium','2026-04-22 10:00:00')
    `);

    await conn.commit();
    console.log('✅  Dados de demonstração criados!\n');
    console.log('   📧  Email:          felicianoaa@email.pt');
    console.log('   🔑  Palavra-passe:  Demo1234!');
    console.log('\n   🌐  Abra: http://localhost:3001\n');
  } catch (err) {
    await conn.rollback();
    console.error('❌  Erro no seed:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
