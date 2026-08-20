
UPDATE public.payment_gateways
SET enabled = true,
    mode = 'live',
    public_config = jsonb_build_object('client_id','BAAxlkvHkBSK_FKe9MeTzSTeTyQGBrs3nTkbrWKlwRBgoy6iBFxfQtHQknHKoneEY_D-B22eJ1bjkX-LRo','card_fields', true),
    credentials = jsonb_build_object('secret','ENRaMOQHAN9R0m0zXhwNadzlveYSr4FHoxpM3NwytUwpOQ1ywPNHv9iZHco5GlG03r-kxYelpFSplgLK')
WHERE gateway_key = 'paypal';
