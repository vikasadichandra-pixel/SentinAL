from rest_framework import serializers
from .models import Violation, Contract

class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = '__all__'

class ViolationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Violation
        fields = '__all__'

class CrawlerReportSerializer(serializers.ModelSerializer):
    # Fix #6: Allow the crawler to send 'video_duration_seconds' safely
    video_duration_seconds = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Violation
        fields = '__all__'

    def create(self, validated_data):
        # Intercept seconds data before saving to DB
        seconds = validated_data.pop('video_duration_seconds', None)
        
        # Convert seconds to minutes if provided
        if seconds is not None:
            validated_data['video_duration_minutes'] = round(seconds / 60.0, 2)
            
        return super().create(validated_data)