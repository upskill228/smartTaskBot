/* Camada de infraestrutura de base de dados (MySQL).

  Responsabilidades:
  - configuração e gestão do pool de ligações
  - exposição de interface única de acesso à base de dados
  - garantia de encoding e consistência de datas
  - evolução defensiva do schema (migrations simples em runtime)

  Este módulo não contém lógica de negócio.
  Apenas assegura que a base de dados está disponível e consistente
  para as camadas superiores (services / AI / tools).
*/

import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

/* Pool de ligações MySQL.

  Objetivo:
  - reutilização de conexões para melhor performance
  - evitar overhead de criação/fecho de ligações por query
  - suportar concorrência de operações no backend
*/
export const db = mysql
    .createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        dateStrings: true, // dateStrings: evita problemas de timezone entre Node e MySQL
        connectionLimit: 10, // controlo de concorrência da pool
        charset: "utf8mb4", // suporte completo a acentos e emojis
    })
    .promise();

/*
  Inicialização e evolução do schema de tasks.

  Este método funciona como um sistema de migrations simplificado (runtime).

  Responsabilidades:
  - garantir existência da tabela tasks
  - garantir consistência estrutural entre versões
  - corrigir automaticamente alterações de schema
*/
export async function ensureTaskSchema() {

    /* Modelo de dados base da entidade Task.

      Representa a estrutura canónica das tarefas no sistema.
    */
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255),
            priority ENUM('LOW','MEDIUM','HIGH','URGENT'),
            due_date DATE,
            space VARCHAR(100),
            assignee VARCHAR(100),
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    /* Garantia de existência da coluna "completed".

      Permite evolução do schema sem perda de dados existentes.
    */
    const [columns] = await db.execute("SHOW COLUMNS FROM tasks LIKE 'completed'");

    if (columns.length === 0) {
        await db.execute(
            'ALTER TABLE tasks ADD COLUMN completed BOOLEAN NOT NULL DEFAULT FALSE AFTER assignee'
        );
    }

    /* Garantia de consistência da coluna updated_at.

      Assegura que:
      - a coluna existe
      - está corretamente configurada para auto-update
      - registos antigos não ficam com valores inválidos
    */
    const [updatedAtColumns] = await db.execute("SHOW COLUMNS FROM tasks LIKE 'updated_at'");

    if (updatedAtColumns.length === 0) {
        await db.execute(
            'ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
        );

        await db.execute('UPDATE tasks SET updated_at = created_at WHERE updated_at IS NULL');
    } else {
        await db.execute(
            'ALTER TABLE tasks MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        );

        /* Correção de dados históricos.

        Garante que todos os registos antigos têm updated_at válido,
        evitando inconsistências em queries futuras.
        */
        await db.execute('UPDATE tasks SET updated_at = created_at WHERE updated_at IS NULL');
    }
}

/*
  Nota arquitetural:

  Este módulo implementa um sistema de auto-healing schema.

  Em vez de depender de migrations formais, o sistema:
  - verifica estrutura em runtime
  - corrige inconsistências automaticamente
  - mantém compatibilidade com versões antigas da base de dados

  Trade-off:
  + alta resiliência em desenvolvimento
  - menos controlo formal de versionamento de schema
*/