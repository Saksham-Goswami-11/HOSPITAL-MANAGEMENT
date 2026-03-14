-- Migration to enhance procurement data integrity and fix stock initialization
-- 1. Add missing metadata columns to purchase_order_items
ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS units_per_pack INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS mrp NUMERIC(12, 2) DEFAULT 0;

-- 2. Update the receiving RPC to handle these fields
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_order_id UUID,
    p_received_by UUID
)
RETURNS VOID AS $$
DECLARE
    v_po RECORD;
    v_item RECORD;
    v_inventory_id UUID;
    -- We use the units_per_pack from the PO ITEM itself if available, 
    -- falling back to 1 or existing inventory value
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
        
        -- Default units_per_pack comes from the item record in the PO
        v_units_per_pack := COALESCE(v_item.units_per_pack, 1);

        -- Try to find existing inventory item in the destination clinic
        IF v_item.inventory_item_id IS NOT NULL THEN
            v_inventory_id := v_item.inventory_item_id;
            -- If we are receiving into an existing record, we respect ITS pack size
            SELECT COALESCE(units_per_pack, v_units_per_pack) INTO v_units_per_pack 
            FROM public.inventory 
            WHERE id = v_inventory_id;
        ELSE
            SELECT id INTO v_inventory_id
            FROM public.inventory 
            WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(v_item.item_name))
              AND clinic_id = v_po.clinic_id
            LIMIT 1;

            IF v_inventory_id IS NOT NULL THEN
                SELECT COALESCE(units_per_pack, v_units_per_pack) INTO v_units_per_pack
                FROM public.inventory
                WHERE id = v_inventory_id;
            END IF;
        END IF;

        IF v_inventory_id IS NOT NULL THEN
            -- Update existing stock
            -- quantity_ordered is usually PACKS in procurement context
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
            -- CRITICAL: quantity in inventory is ALWAYS TOTAL UNITS (pills)
            INSERT INTO public.inventory (
                clinic_id, 
                hospital_id, 
                item_name, 
                quantity, 
                units_per_pack,
                mrp,
                batch_number, 
                expiry_date,
                threshold
            )
            VALUES (
                v_po.clinic_id,
                v_po.hospital_id,
                v_item.item_name,
                (v_item.quantity_ordered * v_units_per_pack), -- Convert packs to units
                v_units_per_pack,
                COALESCE(v_item.mrp, 0),
                COALESCE(v_item.batch_number, 'PO-' || v_po.order_number),
                COALESCE(v_item.expiry_date, CURRENT_DATE + INTERVAL '1 year'),
                10 -- Default threshold
            )
            RETURNING id INTO v_inventory_id;
            
            -- Log stock movement
            INSERT INTO public.stock_logs (inventory_id, change_amount, reason, created_by)
            VALUES (v_inventory_id, (v_item.quantity_ordered * v_units_per_pack), 'PO_INITIAL_STOCK (#' || v_po.order_number || ')', p_received_by);
        END IF;
        
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
