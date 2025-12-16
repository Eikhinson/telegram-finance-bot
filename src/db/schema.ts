export interface Transaction {
    id: string;
    userId: string;        // Telegram user ID
    amount: number;
    category: 'income' | 'expense';
    subcategory: string;   // One of 15 predefined categories
    description: string;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const INCOME_CATEGORIES = [
    'sales',              // Продажи
    'services',           // Услуги
    'consulting',         // Консалтинг
    'other_income',       // Прочие доходы
] as const;

export const EXPENSE_CATEGORIES = [
    'salaries',           // Зарплаты
    'rent',               // Аренда
    'utilities',          // Коммунальные услуги
    'marketing',          // Маркетинг
    'it_services',        // IT услуги
    'office_supplies',    // Офисные принадлежности
    'travel',             // Командировки
    'professional_services', // Профессиональные услуги
    'taxes',              // Налоги
    'insurance',          // Страхование
    'other_expenses',     // Прочие расходы
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type Subcategory = IncomeCategory | ExpenseCategory;
