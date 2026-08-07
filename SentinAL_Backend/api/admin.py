from django.contrib import admin
from .models import Violation, Contract, Territory

admin.site.register(Violation)
admin.site.register(Contract)
admin.site.register(Territory)