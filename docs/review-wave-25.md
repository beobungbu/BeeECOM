# Product review entry + routing — wave 25

This wave improves the merged customer-review lifecycle without changing the underlying review persistence contract.

## Product behavior

- Customers enter review submission from a purchased line in Order Detail.
- The review screen receives `orderId` and `productId` from navigation instead of hard-coding one seed product.
- The review screen validates that the order belongs to the signed demo customer, is paid, and contains the selected product before enabling review submission.
- Customer-scoped review reads restore pending review state after reload.
- Public product review reads continue to expose only `published` records.
- Submitted reviews remain available to the Admin moderation surface through the shared Worker/D1 state.

## Product-quality gate

The flow must remain usable and visually coherent on desktop and mobile, with no horizontal overflow and no serious/critical axe findings. BeeUI is consumed only through public package exports; genuine BeeUI defects are logged upstream rather than patched in BeeECOM.
