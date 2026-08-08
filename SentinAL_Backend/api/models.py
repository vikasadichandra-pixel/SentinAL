from django.db import models

class Territory(models.Model):
    code = models.CharField(max_length=5, unique=True, db_index=True, help_text="e.g., US, IN, JP")
    name = models.CharField(max_length=100, help_text="e.g., United States", null=True, blank=True)

    def __str__(self):
        return self.code

class Contract(models.Model):
    title = models.CharField(max_length=255, db_index=True)
    allowed_territories = models.ManyToManyField(Territory, related_name="contracts")
    
    release_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField()
    
    official_runtime = models.IntegerField(default=0, help_text="Official runtime in minutes")
    pdf_file = models.FileField(upload_to='contracts/', null=True, blank=True)

    def __str__(self):
        return self.title

class Violation(models.Model):
    STATUS_CHOICES = [
        ('OPEN', 'Open'), 
        ('RESOLVED', 'Resolved'),
        ('ENFORCED', 'Enforced')
    ]
    BREACH_CHOICES = [
        ('PIRACY', 'Piracy (Unauthorized Site)'), 
        ('TERRITORY', 'Territory Breach'),
        ('PRE_RELEASE', 'Pre-Release Leak')
    ]

    asset_name = models.CharField(max_length=255, db_index=True) 
    url = models.URLField(max_length=500)
    location = models.CharField(max_length=10, db_index=True) 
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='OPEN', db_index=True)
    breach_type = models.CharField(max_length=20, choices=BREACH_CHOICES, null=True, blank=True, db_index=True)
    
    html_hash = models.CharField(max_length=256, null=True, blank=True) 

    # ── Bounty: Investigation Labels (non-destructive addition) ──
    INVESTIGATION_LABEL_CHOICES = [
        ('SUSPECTED', 'Suspected'),
        ('VERIFIED', 'Verified'),
        ('NEEDS_REVIEW', 'Needs Review'),
    ]
    investigation_label = models.CharField(
        max_length=20,
        choices=INVESTIGATION_LABEL_CHOICES,
        null=True,
        blank=True,
        db_index=True,
        help_text="Reviewer-assigned investigation classification"
    )
    investigator_notes = models.TextField(
        null=True,
        blank=True,
        help_text="Short investigator note for audit trail"
    )

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.asset_name} - {self.location}"


class WhitelistedDomain(models.Model):
    domain = models.CharField(max_length=255, unique=True, db_index=True, help_text="e.g., netflix.com, primevideo.com")
    platform_name = models.CharField(max_length=100, help_text="e.g., Netflix, Amazon Prime")
    is_active = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return self.platform_name