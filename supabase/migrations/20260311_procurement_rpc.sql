-- RPC to handle receiving a purchase order and updating inventory stock
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_order_id UUID,
    p_received_by UUID
)
RETURNS VOID AS $$
DECLARE
    v_po RECORD;
    v_item RECORD;
    v_inventory_id UUID;
    v_units_per_pack INTEGER;
BEGIN
    -- 1. Get and Validate Purchase Order
    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase Order not found';
    END IF;
    
    IF v_po.status = 'received' THEN
        RAISE EXCEPTION 'This order has already been received';
    END IF;

    -- 2. Update Purchase Order Status
    UPDATE public.purchase_orders
    SET 
        status = 'received',
        received_at = now(),
        updated_at = now()
    WHERE id = p_order_id;

    -- 3. Process each item in the order
    FOR v_item IN (SELECT * FROM public.purchase_order_items WHERE purchase_order_id = p_order_id) LOOP
        
        -- Try to find existing inventory item in the destination clinic
        -- We match by name to handle simple cases, ideally would use inventory_item_id if set
        IF v_item.inventory_item_id IS NOT NULL THEN
            v_inventory_id := v_item.inventory_item_id;
            SELECT COALESCE(units_per_pack, 1) INTO v_units_per_pack 
            FROM public.inventory 
            WHERE id = v_inventory_id;
        ELSE
            SELECT id, COALESCE(units_per_pack, 1) INTO v_inventory_id, v_units_per_pack 
            FROM public.inventory 
            WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(v_item.item_name))
              AND clinic_id = v_po.clinic_id
            LIMIT 1;
        END IF;

        IF v_inventory_id IS NOT NULL THEN
            -- Update existing stock
            UPDATE public.inventory
            SET 
                quantity = quantity + (v_item.quantity_ordered * v_units_per_pack),
                last_updated = now()
            WHERE id = v_inventory_id;
            
            -- Log stock movement
            INSERT INTO public.stock_logs (inventory_id, change_amount, reason, created_by)
            VALUES (v_inventory_id, (v_item.quantity_ordered * v_units_per_pack), 'PURCHASE_ORDER (#' || v_po.order_number || ')', p_received_by);
        ELSE
            -- Create new inventory record
            INSERT INTO public.inventory (
                clinic_id, 
                hospital_id, 
                item_name, 
                quantity, 
                batch_number, 
                expiry_date,
                threshold
            )
            VALUES (
                v_po.clinic_id,
                v_po.hospital_id,
                v_item.item_name,
                v_item.quantity_ordered,
                COALESCE(v_item.batch_number, 'PO-' || v_po.order_number),
                COALESCE(v_item.expiry_date, CURRENT_DATE + INTERVAL '1 year'),
                10 -- Default threshold
            )
            RETURNING id INTO v_inventory_id;
            
            -- Log stock movement
            INSERT INTO public.stock_logs (inventory_id, change_amount, reason, created_by)
            VALUES (v_inventory_id, v_item.quantity_ordered, 'PO_INITIAL_STOCK (#' || v_po.order_number || ')', p_received_by);
        END IF;
        
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order TO authenticated;
