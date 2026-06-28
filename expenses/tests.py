from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from .models import Expense


class ExpenseAPITests(APITestCase):
    url = "/api/expenses/"

    def test_create_expense(self):
        response = self.client.post(
            self.url,
            {"date": "2026-06-27", "reason": "Lunch", "amount": "12.50"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Expense.objects.count(), 1)
        expense = Expense.objects.get()
        self.assertEqual(expense.reason, "Lunch")
        self.assertEqual(expense.amount, Decimal("12.50"))

    def test_create_defaults_date_to_today(self):
        response = self.client.post(
            self.url,
            {"reason": "Coffee", "amount": "3.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(Expense.objects.get().date)

    def test_list_returns_created_expenses(self):
        Expense.objects.create(date="2026-06-27", reason="Lunch", amount="12.50")
        Expense.objects.create(date="2026-06-26", reason="Bus", amount="2.00")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_filter_by_day(self):
        Expense.objects.create(date="2026-06-27", reason="Lunch", amount="12.50")
        Expense.objects.create(date="2026-06-26", reason="Bus", amount="2.00")
        response = self.client.get(self.url, {"date": "2026-06-27"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["reason"], "Lunch")

    def test_rejects_non_positive_amount(self):
        for bad_amount in ("0.00", "-5.00"):
            response = self.client.post(
                self.url,
                {"date": "2026-06-27", "reason": "Bad", "amount": bad_amount},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Expense.objects.count(), 0)
