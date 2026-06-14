from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parent
V=ROOT/'backend'/'restaurant'/'views.py';U=ROOT/'backend'/'restaurant'/'urls.py'
for p in(V,U):
    if not p.exists():raise FileNotFoundError(p)
    b=p.with_suffix(p.suffix+'.before_rider_app_patch')
    if not b.exists():shutil.copy2(p,b)
vt=V.read_text(encoding='utf-8');ut=U.read_text(encoding='utf-8')
if 'def rider_update_order_status(' not in vt:
    anchor="@api_view(['GET'])\ndef customer_orders";pos=vt.find(anchor)
    if pos<0:raise RuntimeError('customer_orders not found')
    fn="""@api_view(['POST'])\ndef rider_update_order_status(request, order_code):\n    phone=(request.data.get('phone') or '').strip(); new_status=(request.data.get('status') or '').strip()\n    if not phone or not new_status:return Response({'detail':'phone and status are required'},status=status.HTTP_400_BAD_REQUEST)\n    try:rider=Rider.objects.get(phone=phone,is_active=True)\n    except Rider.DoesNotExist:return Response({'detail':'Rider not found'},status=status.HTTP_404_NOT_FOUND)\n    try:order=Order.objects.select_related('assigned_rider').prefetch_related('items','payments').get(order_code=order_code)\n    except Order.DoesNotExist:return Response({'detail':'Order not found'},status=status.HTTP_404_NOT_FOUND)\n    if order.assigned_rider_id!=rider.id:return Response({'detail':'Este pedido no está asignado a este repartidor.'},status=status.HTTP_403_FORBIDDEN)\n    allowed={Order.STATUS_PENDING:{Order.STATUS_ACCEPTED,Order.STATUS_OUT_FOR_DELIVERY,Order.STATUS_CANCELLED},Order.STATUS_ACCEPTED:{Order.STATUS_OUT_FOR_DELIVERY,Order.STATUS_CANCELLED},Order.STATUS_PREPARING:{Order.STATUS_OUT_FOR_DELIVERY,Order.STATUS_CANCELLED},Order.STATUS_READY:{Order.STATUS_OUT_FOR_DELIVERY,Order.STATUS_CANCELLED},Order.STATUS_OUT_FOR_DELIVERY:{Order.STATUS_DELIVERED,Order.STATUS_CANCELLED}}\n    if new_status not in allowed.get(order.status,set()):return Response({'detail':f'No se puede cambiar {order.status} a {new_status}.'},status=status.HTTP_400_BAD_REQUEST)\n    order.status=new_status;order.save(update_fields=['status','updated_at']);return Response(OrderSerializer(order).data)\n\n\n"""
    vt=vt[:pos]+fn+vt[pos:]
if 'rider_update_order_status,' not in ut:ut=ut.replace('    rider_location,\n','    rider_location,\n    rider_update_order_status,\n',1)
if "rider/orders/<str:order_code>/status/" not in ut:ut=ut.replace("    path('rider/location/', rider_location, name='rider-location'),\n","    path('rider/location/', rider_location, name='rider-location'),\n    path('rider/orders/<str:order_code>/status/', rider_update_order_status, name='rider-update-order-status'),\n",1)
V.write_text(vt,encoding='utf-8');U.write_text(ut,encoding='utf-8');print('PATCH_OK')
