# Local fans backend - Prisma Schema & Migrations

This is the **Local fans backend** service, built with **NestJS** and **MySQL** as the database, using **Prisma** for ORM functionality and **Laravel** for managing migrations. Prisma provides an intuitive API for interacting with the MySQL database, while Laravel handles the migration process.

## Migrations Workflow (Handled through Laravel)

### 1. Define Your Database Schema

In this project, you can still define your database schema in the `prisma/schema.prisma` file. For example, here's a simple `User` model:

```prisma
model User {
  id    Int     @id @default(autoincrement())
  name  String
  email String  @unique
}
```

However, database migrations are now handled by Laravel.

### 2. Generate a Migration with Laravel

When you modify the schema, you'll need to generate a migration using Laravel's built-in migration system

After creating the migration, edit the generated migration file in the `database/migrations` directory.

### 3. Run the Migration

Once the migration file is ready, run the migration to apply the changes to your database:

This will create or update the corresponding database tables based on your migration files.
