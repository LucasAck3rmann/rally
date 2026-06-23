import { IsDateString, IsString } from "class-validator";

export class CreateReservaDto {
  @IsString()
  quadraId!: string;

  @IsDateString()
  inicio!: string;

  @IsDateString()
  fim!: string;
}
