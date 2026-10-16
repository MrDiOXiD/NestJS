import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseEnumPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  DefaultValuePipe,
  BadRequestException,
  UploadedFiles,
} from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { CacheTTL } from "@nestjs/cache-manager";

import { ProductsService } from "../services/products.service";
import { CreateProductDto } from "../dto/create-product.dto";
import { ProductEntity } from "../entities/product.entity";
import { AuthenticationGuard } from "../../utils/guard/auth.guard";
import { AuthorizedGuard } from "../../utils/guard/authorized-role.guard";
import { CurrentUser } from "../../utils/decorators/currentUser.decorator";
import { Roles } from "../../utils/common/Roles.enum";
import { multerConfig } from "../../utils/middleware/multer";
import { UpdateProductDto } from "../dto/update-product.dto";
import { SetFeaturedDto } from "../dto/set-featured.dto";
import { ProductSort } from "../enums/product-sort.enum";
import { SetProductBadgesDto } from "../dto/set-product-badges.dto";
import { UserEntity } from "@/users/entities/user.entity";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
@ApiTags("products")
@ApiBearerAuth()
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @Post()
  @ApiOperation({ summary: "Create a new product with optional discounts" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      // Ensure only the strictly required fields are listed here
      required: ["title", "description", "price", "stock", "categoryId", "productImage"],
      properties: {
        title: { type: "string", example: "لامپ LED حبابی ۹ وات" },
        description: { type: "string", example: "لامپ کم مصرف با طول عمر بالا" },
        price: { type: "number", example: 45000 },
        stock: { type: "number", example: 100 },
        categoryId: { type: "number", example: 1 },
        discount: { type: "number", example: 22, description: "Percentage discount" },
        discountStartDate: { type: "string", format: "date-time" },
        discountEndDate: { type: "string", format: "date-time" },
        isActive: { type: "boolean", default: true },
        isFeatured: { type: "boolean", default: false, description: "Show under sort=featured" },

        // 🌟 NEW: Brand
        brand: {
          type: "string",
          example: "پارس شهاب",
          description: "The manufacturer or brand of the product",
        },

        // 🌟 Badges (multiple, e.g. new + hot at once)
        badges: {
          type: "string",
          example: "[1,3]",
          description: "Badge ids from GET /badges, as \"[1,3]\" or \"1,3\". Max 10, active badges only.",
        },

        // 🌟 NEW: Dynamic Attributes (JSON String)
        attributes: {
          type: "string",
          example: '{"color": "white", "power": "9W", "warranty": "12 months"}',
          description: "A JSON-stringified object containing dynamic key-value pairs.",
        },

        // 🖼️ Image Upload
       // 🖼️ Primary Image (Single)
        productImage: {
          type: 'string',
          format: 'binary',
          description: 'The primary product image',
        },
        
        // 🖼️🖼️ Gallery Images (Array)
        gallery: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Additional gallery images (Max 5)',
        },
      },
    },
  })
 @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'productImage', maxCount: 1 },
      { name: 'gallery', maxCount: 5 },
    ], multerConfig) 
  )
 async createProduct(
    @UploadedFiles() files: { 
      productImage?: Express.Multer.File[]; 
      gallery?: Express.Multer.File[] 
    },
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() currentUser: UserEntity,
  ): Promise<ProductEntity> {
    
    const productImage = files.productImage?.[0];
    
    if (!productImage) {
      throw new BadRequestException("Product primary image is required");
    }

    const galleryImages = files.gallery || []; 

    return this.productsService.createProduct(
      createProductDto, 
      productImage, 
      galleryImages, 
      currentUser
    );
  }

  @Get()
  @CacheTTL(86400000)
  @ApiOperation({ summary: "List products", description: "Paginated product listing, sortable by newest or featured." })
  @ApiQuery({ name: "page", type: Number, required: false, example: 1, description: "1-indexed page number" })
  @ApiQuery({ name: "limit", type: Number, required: false, example: 10, description: "Items per page" })
  @ApiQuery({
    name: "sort",
    enum: ProductSort,
    required: false,
    example: ProductSort.NEWEST,
    description: "'newest' orders by createdAt DESC. 'featured' orders by isFeatured DESC, createdAt DESC.",
  })
  @ApiOkResponse({ description: "Paginated list of products", type: [ProductEntity] })
  async findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("sort", new DefaultValuePipe(ProductSort.NEWEST), new ParseEnumPipe(ProductSort))
    sort: ProductSort,
  ): Promise<ProductEntity[]> {
    return this.productsService.findAll(page, limit, sort);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single product by id" })
  @ApiParam({ name: "id", type: Number, example: 1 })
  @ApiOkResponse({ type: ProductEntity })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<ProductEntity> {
    return this.productsService.findOne(id);
  }

  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @Put(":id")
  @ApiOperation({
    summary: "Update a product",
    description: "JSON body, every field optional. Send null for brand / discountStartDate / discountEndDate to clear them. Images are not editable here.",
  })
  @ApiParam({ name: "id", type: Number, example: 1 })
  @ApiBody({
    type: UpdateProductDto,
    examples: {
      basics: { summary: "Edit basics", value: { title: "لامپ LED حبابی ۱۲ وات", price: 49000, stock: 80 } },
      discount: {
        summary: "Set a discount window",
        value: { discount: 15, discountStartDate: "2026-10-15T00:00:00.000Z", discountEndDate: "2026-10-30T23:59:59.000Z" },
      },
      clearDiscount: {
        summary: "Clear the discount",
        value: { discount: 0, discountStartDate: null, discountEndDate: null },
      },
      brandAndBadges: {
        summary: "Brand, badges and attributes",
        value: { brand: "پارس شهاب", badges: [1, 3], attributes: { color: "white", power: "12W" } },
      },
    },
  })
  @ApiOkResponse({ type: ProductEntity })
  @ApiBadRequestResponse({ description: "Validation failed or unknown/inactive badge id" })
  @ApiNotFoundResponse({ description: "Product or category not found" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductEntity> {
    return this.productsService.update(id, updateProductDto);
  }

  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @Patch(":id/featured")
  @ApiOperation({ summary: "Set or unset a product's featured flag" })
  @ApiParam({ name: "id", type: Number, example: 1 })
  @ApiBody({ type: SetFeaturedDto, examples: { on: { value: { isFeatured: true } } } })
  @ApiOkResponse({ type: ProductEntity })
  async setFeatured(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SetFeaturedDto,
  ): Promise<ProductEntity> {
    return this.productsService.setFeatured(id, dto.isFeatured);
  }

  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @Put(":id/badges")
  @ApiOperation({
    summary: "Replace a product's badges",
    description: "Overwrites the full badge list. Send an empty array to remove all badges.",
  })
  @ApiParam({ name: "id", type: Number, example: 1 })
  @ApiBody({
    type: SetProductBadgesDto,
    examples: {
      multiple: { summary: "Three badges", value: { badgeIds: [1, 2, 3] } },
      clear: { summary: "Remove all badges", value: { badgeIds: [] } },
    },
  })
  @ApiOkResponse({ type: ProductEntity })
  @ApiBadRequestResponse({
    description: "Unknown/inactive badge id, duplicates, or invalid payload",
    example: { statusCode: 400, message: "Unknown or inactive badge id(s): 99", error: "Bad Request" },
  })
  @ApiNotFoundResponse({ description: "Product not found" })
  async setBadges(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SetProductBadgesDto,
  ): Promise<ProductEntity> {
    return this.productsService.setBadges(id, dto.badgeIds);
  }

  @UseGuards(AuthenticationGuard, AuthorizedGuard([Roles.ADMIN]))
  @Delete(":id")
  @ApiOperation({ summary: "Delete a product" })
  @ApiParam({ name: "id", type: Number, example: 1 })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.productsService.delete(id);
  }
}
