from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from django.views.decorators.clickjacking import xframe_options_exempt

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # Points to our API app
    re_path(r'^media/(?P<path>.*)$', xframe_options_exempt(serve), {'document_root': settings.MEDIA_ROOT}),
]