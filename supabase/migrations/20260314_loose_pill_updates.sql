-- Migration: Fix loose pill dispensing logic in RPCs
-- Description: Updates sale_items schema and process_sale/receive_purchase_order RPCs

BEGIN;

-- 1. Update sale_items table schema
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS is_loose_sale BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS units_sold INTEGER;

-- 2. Ensure inventory has units_per_pack (it should, but just in case)
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS units_per_pack INTEGER DEFAULT 1;

-- 3. Update the process_sale RPC function to handle loose sales
CREATE OR REPLACE FUNCTION public.process_sale(
    p_hospital_id UUID, 
    p_clinic_id UUID, 
    p_patient_name TEXT, 
    p_doctor_name TEXT, 
    p_sale_type TEXT, 
    p_payment_mode TEXT, 
    p_amount NUMERIC, 
    p_items JSONB,
    p_subtotal NUMERIC DEFAULT 0,
    p_discount_percentage NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
BEGIN
    -- [SECURITY PATCH Block] Verify caller belongs to the requested clinic or has explicit global oversight
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            clinic_id = p_clinic_id 
            OR role IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'OWNER')
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to process sales for this clinic branch.';
    END IF;

    -- Core sale insert 
    INSERT INTO sales (
        hospital_id, 
        clinic_id, 
        patient_name, 
        doctor_name, 
        sale_type, 
        payment_mode, 
        amount, 
        subtotal, 
        discount_percentage
    )
    VALUES (
        p_hospital_id, 
        p_clinic_id, 
        p_patient_name, 
        p_doctor_name, 
        p_sale_type, 
        p_payment_mode, 
        p_amount, 
        p_subtotal, 
        p_discount_percentage
    )
    RETURNING id INTO v_sale_id;

    -- Optional list iteration if elements are present
    IF p_sale_type = 'PHARMACY' AND p_items IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
            inventory_id UUID, 
            quantity INT, 
            price NUMERIC, 
            is_loose_sale BOOLEAN, 
            units_sold INT
        )
        LOOP
            -- Deduct stock directly from active inventory tracking
            -- quantity here represents total tablets/units
            UPDATE inventory 
            SET quantity = quantity - v_item.quantity
            WHERE id = v_item.inventory_id;
            
            -- Append isolated log for receipt construction
            INSERT INTO sale_items (
                sale_id, 
                inventory_id, 
                quantity, 
                price, 
                is_loose_sale, 
                units_sold
            )
            VALUES (
                v_sale_id, 
                v_item.inventory_id, 
                v_item.quantity, 
                v_item.price, 
                COALESCE(v_item.is_loose_sale, FALSE), 
                COALESCE(v_item.units_sold, v_item.quantity)
            );
        END LOOP;
    END IF;

    RETURN v_sale_id;
END;
$$;

-- 4. Re-apply the receiving RPC fix (ensuring it's consistent with existing fixes)
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
                COALESCE(v_item.mrp, 0), -- Use mrp from PO item
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

COMMIT;
