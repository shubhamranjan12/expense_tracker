from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("date", "reason", "amount")
    list_filter = ("date",)
    search_fields = ("reason",)
